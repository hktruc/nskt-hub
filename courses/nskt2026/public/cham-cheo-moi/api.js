// Nối màn hình với máy chủ nskt-hub (chỉ đọc). Địa chỉ và dạng dữ liệu: xem stage.js.
export const api = {
  async phien() {
    const r = await fetch("/cham-cheo-moi/api/phien", { cache: "no-store" });
    return r.ok ? r.json() : { vaiTro: "khach" };
  },
  async ketQua(ngay, signal) {
    const u = new URL("/cham-cheo-moi/api/ket-qua", location.origin);
    u.searchParams.set("ngay", ngay);
    const r = await fetch(u, { cache: "no-store", headers: { Accept: "application/json" }, signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  },
};
