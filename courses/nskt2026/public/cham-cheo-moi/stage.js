// Màn hình chấm chéo: điều khiển trình chiếu. Chỉ nói chuyện với máy chủ qua `api` (xem api.js), nên chạy được với dữ liệu giả để duyệt giao diện.
//
//   api.phien()            → { vaiTro: "khach" | "btc", ten?: string }
//   api.ketQua(ngay, tin)  → { buoi?: {so, tuan}, doi: [{ma, thanhVien: [{id, ten, vang?}]}], luot: [lượt chấm, xem logic.js] }
//
// Luật trình chiếu (giữ như màn hình cũ):
//  - Hôm nay: chiếu lần lượt các lượt CHƯA chiếu (nhớ trong trình duyệt); lượt mới đến thì xếp hàng, chiếu tiếp theo thứ tự thời gian.
//  - Ngày cũ: tự phát từ đầu.
//  - Hết hàng đợi: luân phiên 12 đội, mỗi đội 10 giây (trừ khi đã ghim đội).
//  - Mỗi 10 giây hỏi dữ liệu mới. Đổi ngày nhanh không để kết quả cũ ghi đè kết quả mới.
import { COLORS, PAGE_LIMIT, TEAM_IDS, agoText, esc, fieldsOf, formatDate, normalizeRecords, paginate, pendingOf, readMs, shortTime, todayVN } from "./logic.js";

const safeStorage = () => {
  try {
    const s = globalThis.localStorage;
    s.getItem("x");
    return s;
  } catch {
    const m = new Map();
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, String(v)) };
  }
};

export function startStage(opts) {
  const { api, root = document, now = () => new Date(), pollMs = 10000, idleMs = 10000, signalMs = 3600, quietMs = 4000, qrSrc = "/cham-cheo-moi/qr.png", loginHref = "/dang-nhap?tiep=%2Fcham-cheo-moi%2F", logoutAction = "/dang-xuat" } = opts;
  const storage = opts.storage ?? safeStorage();
  const $ = (s) => root.querySelector(s);
  const S = {
    role: "khach", user: "", day: "", doi: new Map(), records: [], index: 0, page: 0, pages: [], playing: false,
    focus: "T01", pinned: null, pending: new Map(), known: new Set(), queue: [], eventMode: false,
    loading: false, loaded: false, version: 0, signal: "", speed: 1, lastOk: 0, userPaused: false, invite: null, qrOk: false,
  };
  let readTimer = null, idleTimer = null, signalTimer = null, pollTimer = null, freshTimer = null, quietTimer = null, controller = null;
  let wasPlaying = false, hadIdle = false;
  const today = () => todayVN(now());
  const isToday = () => S.day === today();
  const btc = () => S.role === "btc";
  const setPlayLabel = (t) => { $("#play").textContent = t; };
  const setStatus = (text, state = "ready") => { const el = $("#status"); el.textContent = text; el.dataset.state = state; };

  // ---------- Thanh thời gian đọc (cho người xem biết khi nào đổi trang) ----------
  function resetReadBar(visible) {
    const bar = $("#readbar"), fill = bar.firstElementChild;
    fill.style.transition = "none";
    fill.style.width = "0%";
    bar.style.opacity = visible ? "1" : "0";
    return fill;
  }
  function stopRead() { clearTimeout(readTimer); resetReadBar(false); }
  function startRead(ms) {
    readTimer = setTimeout(advancePage, ms);
    const fill = resetReadBar(true);
    void fill.offsetWidth;
    fill.style.transition = `width ${Math.round(ms)}ms linear`;
    fill.style.width = "100%";
  }

  // ---------- Ghi nhớ lượt đã chiếu (theo ngày) ----------
  const seenKey = () => `nskt-chamcheo-seen:${S.day}`;
  const seenSet = () => { try { return new Set(JSON.parse(storage.getItem(seenKey()) || "[]")); } catch { return new Set(); } };
  const markSeen = (key) => { if (!key) return; const s = seenSet(); s.add(key); storage.setItem(seenKey(), JSON.stringify([...s].slice(-1500))); };

  // ---------- Vẽ ----------
  const members = (team) => S.doi.get(team) ?? [];

  function buildTeams() {
    $("#teams").innerHTML = TEAM_IDS.map((id) => {
      const n = S.pending.get(id) || 0;
      return `<button type="button" class="team-chip${id === S.focus ? " active" : ""}${n > 0 ? " pending" : ""}${id === S.signal ? " signal" : ""}" style="background:${COLORS[id]}" data-team="${id}" aria-label="Đội ${id.slice(1)}${n ? `, ${n} lượt đang chờ` : ""}">${id}${n ? `<span class="badge">${n}</span>` : ""}</button>`;
    }).join("");
  }

  function renderRoster(recipientId = "", signal = false) {
    const list = members(S.focus);
    $("#teamTitle").textContent = `ĐỘI CÁ CHÉP ${S.focus.slice(1)}`;
    $("#roster").innerHTML = list.length
      ? list.map((p) => `<div class="person${btc() ? " person-link" : ""}${p.id === recipientId ? " recipient" : ""}${p.id === recipientId && signal ? " signal" : ""}${btc() && p.vang ? " absent" : ""}" data-id="${esc(p.id)}"${btc() ? ' role="button" tabindex="0"' : ""}><i class="dot"></i><span>${esc(p.ten)}</span></div>`).join("")
      : '<p class="muted">Chưa có danh sách chính thức cho đội này.</p>';
    buildTeams();
  }

  function signalReceiver(team) {
    clearTimeout(signalTimer);
    S.signal = team;
    buildTeams();
    signalTimer = setTimeout(() => { S.signal = ""; buildTeams(); }, signalMs);
  }

  function setPerson(prefix, p) {
    const name = $(`#${prefix}Name`);
    name.textContent = p ? p.ten : "—";
    name.dataset.id = p ? p.id : "";
    name.classList.toggle("person-link", Boolean(p) && btc());
    if (p && btc()) { name.setAttribute("role", "button"); name.setAttribute("tabindex", "0"); } else { name.removeAttribute("role"); name.removeAttribute("tabindex"); }
    $(`#${prefix}Team`).textContent = p ? p.doi : "—";
  }

  function renderEmpty(message, { invite = false } = {}) {
    S.invite = invite ? message : null;
    stopRead();
    S.playing = false; S.index = 0; S.page = 0; S.pages = [];
    $("#eventType").textContent = isToday() ? "CHỜ LƯỢT CHẤM MỚI" : "KHÔNG CÓ DỮ LIỆU";
    $("#eventTime").textContent = formatDate(S.day);
    setPerson("from", null); setPerson("to", null);
    $("#commentBody").innerHTML = invite && S.qrOk
      ? `<div class="invite-wrap"><p>${esc(message)}</p><div class="qr-big"><img src="${esc(qrSrc)}" alt="Mã QR chấm chéo cho học viên"></div></div>`
      : esc(message);
    $("#page").textContent = "TRANG 0/0";
    $("#progress").textContent = `0 lượt · ${formatDate(S.day)}`;
    $("#review").classList.remove("cross"); $("#review").classList.add("same");
    setPlayLabel("▶ Phát lại");
    renderRoster();
    if (!S.pinned) startIdle();
  }

  const pageHtml = (group) => group.map((f) => `<span class="field"><b>${esc(f.label)}${f.label ? ":" : ""}</b> ${esc(f.text)}</span>`).join("");

  /** Chia trang cho vừa khung nhận xét: không co chữ, không cắt ý. Trang nào tràn khung thì chia nhỏ hơn. */
  function fitPages(fields) {
    const box = $(".comment"), body = $("#commentBody");
    if (!box || box.clientHeight === 0) return paginate(fields);
    const fits = (group) => { body.innerHTML = pageHtml(group); return box.scrollHeight <= box.clientHeight + 1; };
    let limit = PAGE_LIMIT, pages = paginate(fields, limit);
    for (let tries = 0; tries < 8 && !pages.every(fits); tries++) { limit = Math.floor(limit * 0.8); pages = paginate(fields, limit); }
    return pages;
  }

  function renderPage() {
    const r = S.records[S.index];
    if (!r) return;
    const group = S.pages[S.page];
    $("#commentBody").innerHTML = pageHtml(group);
    $("#page").textContent = `TRANG ${S.page + 1}/${S.pages.length}`;
    $("#progress").textContent = `Lượt ${S.index + 1}/${S.records.length} · ${shortTime(r.gui)} · ${isToday() ? "TRỰC TIẾP" : "LỊCH SỬ"} ${formatDate(S.day)}`;
    stopRead();
    if (S.playing) startRead(readMs($("#commentBody").textContent.length, S.speed));
  }

  function show(i, { animate = true, consume = true } = {}) {
    if (!S.records.length) return;
    stopIdle();
    S.index = Math.max(0, Math.min(i, S.records.length - 1));
    S.page = 0;
    const r = S.records[S.index];
    S.focus = r.nguoiNhan.doi;
    if (consume) S.pending.set(S.focus, Math.max(0, (S.pending.get(S.focus) || 1) - 1));
    const cross = r.nguoiCham.doi !== r.nguoiNhan.doi;
    const card = $("#review");
    card.classList.toggle("cross", cross);
    card.classList.toggle("same", !cross);
    card.style.setProperty("--event-bg", COLORS[r.nguoiNhan.doi]);
    card.style.setProperty("--from", COLORS[r.nguoiCham.doi]);
    card.style.setProperty("--to", COLORS[r.nguoiNhan.doi]);
    $("#eventType").textContent = cross ? "CHẤM LIÊN ĐỘI" : "CHẤM NỘI BỘ";
    $("#eventTime").textContent = shortTime(r.gui);
    setPerson("from", r.nguoiCham); setPerson("to", r.nguoiNhan);
    S.pages = fitPages(fieldsOf(r));
    if (animate) S.signal = S.focus;
    renderRoster(r.nguoiNhan.id, animate);
    if (animate) signalReceiver(S.focus);
    renderPage();
    if (animate) card.animate?.([{ opacity: 0.65, transform: "translateY(12px) scale(.985)" }, { opacity: 1, transform: "none" }], { duration: 650, easing: "cubic-bezier(.16,1,.3,1)" });
  }

  // ---------- Phát, hàng đợi, luân phiên ----------
  function stopIdle() { clearInterval(idleTimer); idleTimer = null; }
  function startIdle() {
    stopIdle();
    if (S.pinned) return;
    idleTimer = setInterval(() => { S.focus = TEAM_IDS[(TEAM_IDS.indexOf(S.focus) + 1) % TEAM_IDS.length]; renderRoster(); }, idleMs);
  }

  function finishPlayback() {
    S.eventMode = false; S.playing = false;
    stopRead();
    setPlayLabel("▶ Phát lại");
    if (S.pinned) { S.focus = S.pinned; renderRoster(); } else startIdle();
  }

  function startNextEvent() {
    while (S.queue.length) {
      const key = S.queue.shift();
      const at = S.records.findIndex((r) => r.khoa === key);
      if (at < 0) continue;
      S.eventMode = true; S.playing = true;
      show(at);
      setPlayLabel("❚❚ Tạm dừng");
      return;
    }
    finishPlayback();
  }

  function advancePage() {
    if (S.page < S.pages.length - 1) { S.page++; renderPage(); return; }
    if (S.eventMode) {
      markSeen(S.records[S.index]?.khoa);
      if (S.queue.length) startNextEvent(); else finishPlayback();
      return;
    }
    if (S.index < S.records.length - 1) show(S.index + 1); else finishPlayback();
  }

  // ---------- Lấy dữ liệu ----------
  async function fetchDay(day) {
    controller?.abort();
    const mine = new AbortController();
    controller = mine;
    const timeout = setTimeout(() => mine.abort("timeout"), 30000);
    try {
      return await api.ketQua(day, mine.signal);
    } catch (e) {
      if (mine.signal.aborted && mine.signal.reason === "timeout") throw new Error("LIVE_SYNC_TIMEOUT");
      throw e;
    } finally {
      clearTimeout(timeout);
      if (controller === mine) controller = null;
    }
  }

  function applyDay(data) {
    S.doi = new Map((data.doi || []).map((d) => [d.ma, d.thanhVien || []]));
    $("#sessionName").textContent = data.buoi ? `BUỔI ${data.buoi.so} · TUẦN ${data.buoi.tuan}` : "CHẤM CHÉO ĐỒNG ĐỘI & LIÊN ĐỘI";
  }

  async function sync(initial = false) {
    if (S.loading) return;
    const version = S.version;
    const first = initial || !S.loaded;
    S.loading = true;
    if (first) setStatus("ĐANG TẢI DỮ LIỆU", "loading");
    try {
      const data = await fetchDay(S.day);
      if (version !== S.version) return;
      applyDay(data);
      const next = normalizeRecords(data.luot);
      const fresh = next.filter((r) => !S.known.has(r.khoa));
      if (first) {
        S.records = next; S.known = new Set(next.map((r) => r.khoa)); S.pending = new Map(); S.queue = []; S.eventMode = false; S.index = 0;
        if (!next.length) renderEmpty(isToday() ? "Chưa có lượt chấm nào hôm nay. Mời cả lớp quét mã QR bằng Zalo để bắt đầu chấm chéo; màn hình tự chiếu khi có lượt đầu tiên." : "Không có lượt chấm trong ngày đã chọn.", { invite: isToday() });
        else if (isToday()) {
          S.index = next.length - 1; S.playing = false;
          show(S.index, { animate: false, consume: false });
          setPlayLabel("▶ Phát lại");
          startIdle();
          const seen = seenSet();
          const unseen = next.filter((r) => !seen.has(r.khoa));
          if (unseen.length) { S.queue = unseen.map((r) => r.khoa); S.pending = pendingOf(unseen); startNextEvent(); }
        } else {
          S.pending = pendingOf(next);
          S.playing = true;
          show(0, { animate: false });
          setPlayLabel("❚❚ Tạm dừng");
        }
        S.loaded = true;
      } else {
        const currentKey = S.records[S.index]?.khoa;
        S.records = next;
        if (currentKey) { const at = next.findIndex((r) => r.khoa === currentKey); if (at >= 0) S.index = at; }
        for (const r of fresh) { S.known.add(r.khoa); S.queue.push(r.khoa); S.pending.set(r.nguoiNhan.doi, (S.pending.get(r.nguoiNhan.doi) || 0) + 1); }
        if (!S.eventMode && !S.playing) renderRoster(); else buildTeams();
        if (S.queue.length && !S.eventMode && !$("#person").open) startNextEvent();
      }
      S.lastOk = Date.now(); updateFresh();
      setStatus(isToday() ? "ĐANG CHẠY THỰC TẾ" : "ĐANG XEM LỊCH SỬ");
    } catch (error) {
      if (version !== S.version) return;
      setStatus(error.message === "LIVE_SYNC_TIMEOUT" ? "NGUỒN PHẢN HỒI CHẬM · ĐANG THỬ LẠI" : "NGUỒN DỮ LIỆU ĐANG LỖI · ĐANG THỬ LẠI", "error");
      if (first) renderEmpty("Chưa tải được dữ liệu cho ngày đã chọn. Hệ thống đang tự thử lại.");
      throw error;
    } finally {
      if (version === S.version) S.loading = false;
    }
  }

  async function switchDay(day) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day === S.day) return;
    S.version++;
    controller?.abort();
    S.loading = false;
    stopRead(); stopIdle();
    S.playing = false; S.userPaused = false; S.lastOk = 0; updateFresh(); S.loaded = false; S.eventMode = false; S.queue = []; S.known.clear(); S.records = []; S.pending = new Map(); S.day = day;
    $("#dayInput").value = day;
    renderEmpty("Đang tải dữ liệu của ngày đã chọn…");
    await sync(true).catch(() => {});
  }

  // ---------- Hộp xem một thành viên (BTC) ----------
  function identity(id) {
    for (const [ma, list] of S.doi) { const p = list.find((m) => m.id === id); if (p) return { id, ten: p.ten, doi: ma }; }
    const r = S.records.find((x) => x.nguoiCham.id === id || x.nguoiNhan.id === id);
    if (!r) return null;
    return r.nguoiCham.id === id ? r.nguoiCham : r.nguoiNhan;
  }
  const detailItems = (items, dir) => items.length
    ? items.map((r) => { const o = dir === "given" ? r.nguoiNhan : r.nguoiCham; return `<li><b>${esc(o.ten)}</b><span>${esc(o.doi)} · ${esc(r.gui ? shortTime(r.gui, true) : "Không có thời gian hợp lệ")}</span></li>`; }).join("")
    : '<li class="empty">Không có lượt nào trong ngày đã chọn.</li>';

  function openPerson(id) {
    if (!btc()) return;
    const p = identity(id);
    if (!p) return;
    const given = S.records.filter((r) => r.nguoiCham.id === id), received = S.records.filter((r) => r.nguoiNhan.id === id);
    wasPlaying = S.playing; hadIdle = Boolean(idleTimer);
    stopRead(); stopIdle();
    $("#personDay").textContent = `Dữ liệu ngày ${formatDate(S.day)}`;
    $("#personName").textContent = p.ten;
    $("#personTeam").textContent = p.doi;
    $("#givenTitle").textContent = `ĐÃ CHẤM CHO (${given.length})`;
    $("#receivedTitle").textContent = `ĐƯỢC CHẤM BỞI (${received.length})`;
    $("#givenList").innerHTML = detailItems(given, "given");
    $("#receivedList").innerHTML = detailItems(received, "received");
    $("#person").showModal();
  }
  function afterPerson() {
    if (wasPlaying) { S.playing = true; renderPage(); } else if (hadIdle && !S.pinned) startIdle();
  }

  // ---------- Tài khoản, QR ----------
  function renderAccount(user) {
    document.body.dataset.role = S.role;
    const box = $("#account");
    box.innerHTML = S.role === "btc"
      ? `<span class="who">${esc(user || "BTC")} · BTC</span><form method="post" action="${esc(logoutAction)}"><button type="submit">Đăng xuất</button></form>`
      : `<a href="${esc(loginHref)}">Đăng nhập BTC</a>`;
  }
  function setupQr() {
    const img = $("#qr");
    img.onload = () => { S.qrOk = true; $("#qrCrop").hidden = false; $("#qrPending").hidden = true; if (S.invite && !S.records.length) renderEmpty(S.invite, { invite: true }); };
    img.onerror = () => { S.qrOk = false; $("#qrCrop").hidden = true; $("#qrPending").hidden = false; };
    img.src = qrSrc;
  }

  // ---------- Sự kiện ----------
  const on = (el, ev, fn) => el.addEventListener(ev, fn);
  on(root, "click", (e) => {
    const chip = e.target.closest?.(".team-chip");
    if (chip) { S.focus = chip.dataset.team; S.pinned = S.focus; stopIdle(); renderRoster(); $("#pin").setAttribute("aria-pressed", "true"); $("#pin").textContent = "Bỏ ghim"; return; }
    const link = e.target.closest?.(".person-link");
    if (link && btc()) openPerson(link.dataset.id);
  });
  on(root, "keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches?.(".person-link")) { e.preventDefault(); openPerson(e.target.dataset.id); }
  });
  on($("#play"), "click", () => {
    S.playing = !S.playing;
    S.userPaused = !S.playing;
    updateFresh();
    setPlayLabel(S.playing ? "❚❚ Tạm dừng" : "▶ Tiếp tục");
    stopRead(); stopIdle();
    if (S.playing) {
      if (S.index === S.records.length - 1 && S.page === S.pages.length - 1) { S.index = 0; S.pending = pendingOf(S.records); show(0, { animate: false }); } else renderPage();
    } else if (S.pinned) { S.focus = S.pinned; renderRoster(); } else startIdle();
  });
  on($("#prev"), "click", () => show(S.index - 1, { consume: false }));
  on($("#next"), "click", () => show(S.index + 1, { consume: false }));
  on($("#restart"), "click", () => { S.playing = false; S.eventMode = false; setPlayLabel("▶ Phát"); S.index = 0; S.pending = pendingOf(S.records); show(0, { animate: false, consume: false }); });
  on($("#pin"), "click", () => {
    if (S.pinned) { S.pinned = null; $("#pin").setAttribute("aria-pressed", "false"); $("#pin").textContent = "Ghim đội"; if (!S.playing) startIdle(); }
    else { S.pinned = S.focus; stopIdle(); $("#pin").setAttribute("aria-pressed", "true"); $("#pin").textContent = "Bỏ ghim"; }
  });
  // ---------- Tuỳ chọn (nhớ trong trình duyệt), cỡ chữ ----------
  const OPT_KEY = "nskt-chamcheo-tuychon";
  const saveOpts = (o) => { try { storage.setItem(OPT_KEY, JSON.stringify(o)); } catch { /* bỏ qua */ } };
  const loadOpts = () => { try { return JSON.parse(storage.getItem(OPT_KEY) || "{}") || {}; } catch { return {}; } };
  function applyFont(v, refit = true) {
    const n = Number(v) || 1;
    document.documentElement.style.setProperty("--chu", String(n));
    $("#fontSize").value = String(n);
    if (!refit) return;
    const r = S.records[S.index];
    if (!r) return;
    S.pages = fitPages(fieldsOf(r)); S.page = Math.min(S.page, S.pages.length - 1); renderPage();
  }
  const opts0 = loadOpts();
  if (opts0.speed) { S.speed = Number(opts0.speed) || 1; if ([...$("#speed").options].some((o) => o.value === String(S.speed))) $("#speed").value = String(S.speed); else S.speed = 1; }
  if (opts0.font) applyFont(opts0.font, false);
  on($("#speed"), "change", (e) => { S.speed = Number(e.target.value) || 1; saveOpts({ ...loadOpts(), speed: S.speed }); if (S.playing) renderPage(); });
  on($("#fontSize"), "change", (e) => { applyFont(e.target.value); saveOpts({ ...loadOpts(), font: Number(e.target.value) || 1 }); });

  // ---------- Độ mới của dữ liệu ----------
  function updateFresh() {
    const el = $("#fresh");
    if (!el) return;
    if (!isToday() || !S.lastOk) { el.textContent = ""; el.dataset.stale = "false"; return; }
    const sec = Math.floor((Date.now() - S.lastOk) / 1000);
    el.textContent = agoText(sec) + (S.userPaused ? " · ❚❚ ĐÃ TẠM DỪNG" : "");
    el.dataset.stale = sec > 30 ? "true" : "false";
  }
  freshTimer = setInterval(updateFresh, 1000);

  // ---------- Phím tắt ----------
  on(document, "keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t?.matches?.("input, select, textarea") || $("#person").open) return;
    const click = (id) => { e.preventDefault(); $(id).click(); };
    switch (e.key) {
      case " ": if (t?.matches?.("button, a, .person-link")) return; click("#play"); break;
      case "ArrowRight": case "PageDown": click("#next"); break;
      case "ArrowLeft": case "PageUp": click("#prev"); break;
      case "Home": click("#restart"); break;
      case "f": case "F": click("#fullscreen"); break;
      case "p": case "P": click("#pin"); break;
      default: return;
    }
  });
  // Bấm nút xong thì bỏ tiêu điểm để phím Cách không bấm lại nút đó.
  on($(".controls"), "click", (e) => { const b = e.target.closest?.("button"); if (b) b.blur(); });

  // ---------- Chế độ chiếu: vài giây không chạm thì ẩn thanh điều khiển ----------
  const phone = () => window.matchMedia?.("(max-width: 760px)").matches;
  function wake() {
    document.body.classList.remove("quiet");
    clearTimeout(quietTimer);
    if (phone() || $("#person").open) return;
    quietTimer = setTimeout(() => { if (!$("#person").open && !phone()) document.body.classList.add("quiet"); }, quietMs);
  }
  for (const ev of ["pointermove", "pointerdown", "touchstart"]) on(document, ev, wake);
  on(document, "keydown", wake);
  wake();
  on($("#fullscreen"), "click", () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()));
  on($("#dayInput"), "change", (e) => switchDay(e.target.value));
  let resizeTimer = null;
  on(window, "resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const r = S.records[S.index];
      if (!r) return;
      const ratio = S.page / Math.max(1, S.pages.length);
      S.pages = fitPages(fieldsOf(r));
      S.page = Math.min(S.pages.length - 1, Math.floor(ratio * S.pages.length));
      renderPage();
    }, 200);
  });
  on($("#closePerson"), "click", () => $("#person").close());
  on($("#person"), "close", afterPerson);

  // ---------- Khởi động ----------
  (async () => {
    const phien = await Promise.resolve(api.phien()).catch(() => ({ vaiTro: "khach" }));
    S.role = phien.vaiTro === "btc" ? "btc" : "khach";
    renderAccount(phien.ten);
    setupQr();
    S.day = today();
    $("#dayInput").value = S.day;
    renderEmpty("Đang tải dữ liệu của ngày hôm nay…");
    await sync(true).catch(() => {});
    pollTimer = setInterval(() => sync(false).catch(() => {}), pollMs);
  })();

  return {
    state: S,
    sync: (initial) => sync(initial),
    switchDay,
    /** Nhảy tới trang n của lượt đang chiếu (dùng khi kiểm tra). */
    showPage(n) { S.page = Math.max(0, Math.min(n, S.pages.length - 1)); renderPage(); },
    destroy() { stopRead(); clearInterval(freshTimer); clearTimeout(quietTimer); clearTimeout(signalTimer); clearInterval(idleTimer); clearInterval(pollTimer); controller?.abort(); },
  };
}
