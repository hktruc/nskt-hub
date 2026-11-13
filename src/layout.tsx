import { raw } from "hono/html";
import type { Child } from "hono/jsx";

const css = `
:root { color-scheme: light dark;
  /* Màu theo logo "Nhân Sự Kế Thừa 2026": xanh dương bánh lái (chính), xanh ngọc ô 2026 (phụ), cam "Kế Thừa" (nhấn). */
  --bg:#F3F8FA; --card:#FFFFFF; --fg:#0B3B4E; --muted:#4B6573; --line:#D3E6EC; --soft:#E8F2F6;
  --accent:#076A8F; --on-accent:#FFFFFF; --teal:#1D9195; --orange:#FB9E20; --orange-fg:#9A5A00;
  --shadow:0 1px 2px rgba(11,59,78,.06), 0 2px 8px rgba(11,59,78,.06);
  --ok-bg:#E7F7EF; --ok-fg:#166534; --warn-bg:#FFF1E7; --warn-fg:#9A3412; --bad-bg:#FDECEC; --bad-fg:#B91C1C;
  --radius:12px; --font:"Be Vietnam Pro", system-ui, sans-serif; }
@media (prefers-color-scheme: dark) { :root {
  --bg:#0D1B22; --card:#13262F; --fg:#E3F0F5; --muted:#9BB4BF; --line:#24404C; --soft:#1A3340;
  --accent:#5BBDE0; --on-accent:#03202B; --teal:#4FC3C7; --orange:#FBB04E; --orange-fg:#FBB04E;
  --shadow:none;
  --ok-bg:#12342A; --ok-fg:#86EFAC; --warn-bg:#3A2412; --warn-fg:#FDBA74; --bad-bg:#3A1616; --bad-fg:#FCA5A5; } }
* { box-sizing:border-box; }
body { margin:0; font:16px/1.55 var(--font); color:var(--fg); background:var(--bg); }
header.top { position:sticky; top:0; z-index:20; background:var(--card); border-bottom:1px solid var(--line); box-shadow:var(--shadow); }
.top-in { max-width:1120px; margin:0 auto; padding:6px 16px; display:flex; align-items:center; gap:4px; min-height:56px; }
.brand { display:inline-flex; align-items:center; margin-right:auto; text-decoration:none; }
.brand img { height:38px; width:auto; display:block; }
@media (prefers-color-scheme: dark) { .brand img { background:#fff; border-radius:8px; padding:3px 6px; height:40px; } }
.nav-top { display:none; gap:2px; }
.nav-top a, .nav-more summary { display:inline-flex; align-items:center; gap:6px; min-height:40px; padding:6px 12px; border-radius:999px; color:var(--fg); text-decoration:none; font-weight:500; font-size:.9375rem; cursor:pointer; }
.nav-top a:hover, .nav-more summary:hover { background:var(--soft); }
.nav-top a[aria-current], .nav-tab[aria-current] { color:var(--accent); }
.nav-top a[aria-current] { background:var(--soft); font-weight:700; }
.nav-top svg, .nav-tab svg, .nav-more svg { width:18px; height:18px; flex:none; }
.nav-more { position:relative; } .nav-more summary { list-style:none; } .nav-more summary::-webkit-details-marker { display:none; }
.nav-more .menu { position:absolute; right:0; top:calc(100% + 6px); background:var(--card); border:1px solid var(--line); border-radius:14px; box-shadow:0 8px 28px rgba(11,59,78,.16); padding:6px; min-width:210px; display:flex; flex-direction:column; z-index:30; }
.nav-more .menu a { display:flex; align-items:center; gap:10px; min-height:44px; padding:8px 12px; border-radius:10px; color:var(--fg); text-decoration:none; }
.nav-more .menu a:hover { background:var(--soft); }
.nav-bottom { position:fixed; left:0; right:0; bottom:0; z-index:20; display:flex; background:var(--card); border-top:1px solid var(--line); padding:4px 4px calc(4px + env(safe-area-inset-bottom)); box-shadow:0 -2px 10px rgba(11,59,78,.06); }
.nav-tab { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; min-height:52px; color:var(--muted); text-decoration:none; font-size:.6875rem; font-weight:600; border-radius:10px; }
.nav-tab svg { width:22px; height:22px; }
.nav-tab[aria-current] svg { stroke:var(--accent); }
.nav-tab[aria-current]::before { content:""; width:28px; height:3px; border-radius:3px; background:var(--orange); margin:-6px 0 3px; }
.nav-bottom .nav-more { flex:1; display:flex; } .nav-bottom .nav-more summary { flex:1; flex-direction:column; gap:2px; min-height:52px; padding:0; font-size:.6875rem; font-weight:600; color:var(--muted); justify-content:center; border-radius:10px; }
.nav-bottom .nav-more summary svg { width:22px; height:22px; }
.nav-bottom .nav-more .menu { top:auto; bottom:calc(100% + 8px); right:4px; }
body.has-bottom main { padding-bottom:96px; }
@media (min-width: 760px) { .nav-top { display:flex; } .nav-bottom { display:none; } body.has-bottom main { padding-bottom:32px; } }
main { max-width:960px; margin:0 auto; padding:20px 16px 32px; }
a { color:var(--accent); }
h1 { font-size:1.375rem; line-height:1.3; margin:0 0 12px; }
h2 { font-size:1.125rem; margin:28px 0 8px; }
.muted { color:var(--muted); }
.warn, .notice { padding:12px 14px; border-radius:var(--radius); }
.warn { background:var(--warn-bg); color:var(--warn-fg); }
.notice { background:var(--ok-bg); color:var(--ok-fg); }
.tiles { display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:10px; margin:16px 0; }
.tile { background:var(--card); border:1px solid var(--line); border-radius:var(--radius); padding:12px 14px; box-shadow:var(--shadow); }
.tile .num { font-size:1.6rem; font-weight:700; font-variant-numeric:tabular-nums; }
.tile .lbl { color:var(--muted); font-size:.875rem; }
table { border-collapse:collapse; width:100%; font-size:.9375rem; background:var(--card); }
th, td { text-align:left; padding:8px 10px; border-bottom:1px solid var(--line); vertical-align:top; }
th { color:var(--muted); font-weight:600; white-space:nowrap; }
td:first-child { white-space:nowrap; }
td.r { text-align:right; font-variant-numeric:tabular-nums; }
.scroll { overflow-x:auto; border:1px solid var(--line); border-radius:var(--radius); }
.scroll table { border:0; }
.actions { display:flex; gap:10px; flex-wrap:wrap; }
button { font:600 15px var(--font); min-height:44px; padding:8px 16px; border-radius:var(--radius); border:1px solid var(--accent); background:var(--accent); color:var(--on-accent); cursor:pointer; }
button.secondary { background:var(--soft); color:var(--fg); border-color:var(--line); }
button:focus-visible, a:focus-visible { outline:3px solid var(--accent); outline-offset:2px; }
.badge { display:inline-block; font-size:.8125rem; font-weight:600; padding:2px 10px; border-radius:999px; }
.badge.ok { background:var(--ok-bg); color:var(--ok-fg); }
.badge.warn { background:var(--warn-bg); color:var(--warn-fg); }
.badge.bad { background:var(--bad-bg); color:var(--bad-fg); }
code { font-size:.9em; }
.log { list-style:none; margin:0; padding:0; background:var(--card); border:1px solid var(--line); border-radius:var(--radius); }
.log li { padding:10px 14px; border-bottom:1px solid var(--line); font-size:.9375rem; }
.log li:last-child { border-bottom:0; }
.log .log-top { display:flex; justify-content:space-between; gap:8px; align-items:flex-start; }
.log .muted { font-size:.8125rem; }
.small { font-size:.8125rem; }
.pick label { font-weight:600; font-size:.875rem; display:block; margin-bottom:4px; }
.pick-row { display:flex; gap:8px; }
.pick select { flex:1; min-width:0; min-height:44px; font:15px var(--font); border:1px solid var(--line); border-radius:var(--radius); padding:8px 10px; background:var(--card); color:var(--fg); }
.pick p { margin:6px 0 0; }
.chips { display:flex; gap:8px; overflow-x:auto; padding:12px 0 4px; margin:0 -16px; padding-left:16px; padding-right:16px; scrollbar-width:none; }
/* Máy tính: xuống dòng cho thấy hết các nút, không phải kéo ngang. */
@media (min-width: 640px) { .chips { flex-wrap:wrap; overflow:visible; margin:0; padding-left:0; padding-right:0; } }
.older-weeks { max-width:420px; margin:8px 0 0; } .older-weeks select { flex:1; min-height:44px; border:1px solid var(--line); border-radius:999px; padding:6px 14px; font:15px var(--font); background:var(--card); color:var(--fg); }
.older-weeks select.on, .older-weeks select:has(option:checked:not([value=""])) { border-color:var(--accent); box-shadow:inset 0 0 0 1px var(--accent); }
.chips-label { font-size:.8125rem; font-weight:600; color:var(--muted); margin:12px 0 0; }
.chip { flex:none; display:inline-flex; align-items:center; min-height:40px; padding:6px 14px; border-radius:999px; border:1px solid var(--line); background:var(--card); color:var(--fg); text-decoration:none; font-weight:500; font-size:.9375rem; }
.chip.on { background:var(--accent); border-color:var(--accent); color:var(--on-accent); }
a.tile { color:inherit; text-decoration:none; }
.tile.on { border-color:var(--accent); box-shadow:inset 0 0 0 1px var(--accent); }
.list { list-style:none; margin:0; padding:0; background:var(--card); border:1px solid var(--line); border-radius:var(--radius); }
.list > li { padding:12px 14px; border-bottom:1px solid var(--line); }
.list > li:last-child { border-bottom:0; }
.row-link { display:block; color:inherit; text-decoration:none; }
.row-top { display:flex; justify-content:space-between; gap:8px; align-items:flex-start; }
.bar { height:6px; border-radius:999px; background:var(--soft); margin:8px 0; overflow:hidden; }
.bar span { display:block; height:100%; background:var(--accent); border-radius:999px; }
.media-chips { display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; }
.mc { display:inline-flex; align-items:center; gap:4px; font-size:.8125rem; font-weight:600; padding:3px 10px; border-radius:999px; background:var(--soft); }
.mc.v svg { color:#DC2626; } .mc.i svg { color:var(--accent); }
.legend { display:flex; flex-wrap:wrap; gap:6px 10px; margin:10px 0; font-size:.8125rem; }
.rules { background:var(--card); border:1px solid var(--line); border-radius:var(--radius); padding:10px 14px; margin:16px 0 8px; font-size:.8125rem; }
.rules h2 { font-size:.875rem; margin:0 0 4px; }
.rules ul { padding-left:18px; margin:4px 0; } .rules li { margin:4px 0; }
.rules p { margin:4px 0; }
:root { --g-bg:#DCFCE7; --g-fg:#14532D; --y-bg:#FEF3C7; --y-fg:#713F12; --r-bg:#FEE2E2; --r-fg:#7F1D1D; }
@media (prefers-color-scheme: dark) { :root { --g-bg:#123D26; --g-fg:#BBF7D0; --y-bg:#3D2E0B; --y-fg:#FDE68A; --r-bg:#451515; --r-fg:#FECACA; } }
.swatch { padding:3px 10px; border-radius:999px; font-weight:600; font-size:.8125rem; }
.swatch.xanh, .rank-row.xanh { background:var(--g-bg); color:var(--g-fg); }
.swatch.vang, .rank-row.vang { background:var(--y-bg); color:var(--y-fg); }
.swatch.do, .rank-row.do { background:var(--r-bg); color:var(--r-fg); }
.sr { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
.qa { list-style:none; margin:16px 0; padding:0; display:flex; flex-direction:column; gap:12px; }
.qa > li { background:var(--card); border:1px solid var(--line); border-radius:var(--radius); padding:12px 14px; }
.qa > li.flagged { border-color:var(--bad-fg); }
.qa summary { cursor:pointer; display:flex; flex-direction:column; gap:2px; list-style:none; }
.qa summary::-webkit-details-marker { display:none; }
.qa .qtext { font-weight:600; font-size:.9375rem; }
.qa .qfull { white-space:pre-wrap; font-size:.875rem; color:var(--muted); }
.qa .answer { white-space:pre-wrap; overflow-wrap:anywhere; margin:10px 0; }
.media { display:flex; flex-wrap:wrap; gap:8px; margin:8px 0; }
.btn-media { display:inline-flex; align-items:center; min-height:44px; padding:8px 14px; border-radius:var(--radius); background:var(--soft); border:1px solid var(--line); color:var(--fg); text-decoration:none; font-weight:600; font-size:.9375rem; }
.btn-media.v::before { content:""; border-left:10px solid #DC2626; border-top:6px solid transparent; border-bottom:6px solid transparent; margin-right:8px; }
.yt { position:relative; display:block; width:100%; max-width:480px; aspect-ratio:16/9; border-radius:var(--radius); overflow:hidden; background:#111; }
.yt img { width:100%; height:100%; object-fit:cover; display:block; }
.yt .play { position:absolute; inset:0; margin:auto; width:64px; height:44px; border-radius:12px; background:#DC2626; }
.yt .play::after { content:""; position:absolute; left:26px; top:12px; border-left:18px solid #fff; border-top:10px solid transparent; border-bottom:10px solid transparent; }
.thumbs { display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; width:100%; }
.thumbs img { width:100%; aspect-ratio:1; object-fit:cover; border-radius:8px; display:block; background:var(--soft); }
.score-row { display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:8px; border-top:1px solid var(--line); padding-top:10px; margin-top:8px; }
.score-row .edit { display:flex; gap:6px; }
.score-row input { width:5.5em; min-height:44px; font:16px var(--font); border:1px solid var(--line); border-radius:var(--radius); padding:6px 10px; background:var(--card); color:var(--fg); }
.rank-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:3px; }
.rank-row { display:flex; align-items:center; gap:8px; min-height:32px; padding:4px 10px; border-radius:8px; font-size:.8125rem; line-height:1.3; }
.rank-row .rank { flex:none; width:2em; text-align:right; font-weight:700; font-variant-numeric:tabular-nums; opacity:.75; }
.rank-row .name { flex:1; min-width:0; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.rank-row .team { flex:none; font-size:.75rem; opacity:.8; white-space:nowrap; }
.rank-row .pct { flex:none; width:3.8em; text-align:right; font-weight:700; font-variant-numeric:tabular-nums; }
a.rank-row { color:inherit; text-decoration:none; }
a.rank-row:hover .name { text-decoration:underline; }
dialog.sheet { border:0; padding:0; border-radius:16px; width:min(560px, calc(100vw - 24px)); max-height:88vh; background:var(--bg); color:var(--fg); box-shadow:0 10px 40px rgba(0,0,0,.25); }
dialog.sheet::backdrop { background:rgba(4,32,29,.45); }
.sheet-body { padding:14px 16px 18px; }
.hv-detail h2 { font-size:.9375rem; margin:18px 0 6px; }
.sheet .hv-head { position:sticky; top:0; z-index:1; }
.hv-head { display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:var(--radius); }
.hv-head > div:first-child { flex:1; min-width:0; }
.hv-head.xanh { background:var(--g-bg); color:var(--g-fg); } .hv-head.vang { background:var(--y-bg); color:var(--y-fg); } .hv-head.do { background:var(--r-bg); color:var(--r-fg); }
.hv-name { font-weight:700; font-size:1.0625rem; line-height:1.3; }
.hv-pct { font-size:1.5rem; font-weight:700; font-variant-numeric:tabular-nums; }
.hv-head .close { min-height:40px; min-width:40px; padding:0; background:transparent; border:0; color:inherit; font-size:1.125rem; }
.hv-parts { display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:8px; }
.hv-parts div { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:6px 10px; display:flex; justify-content:space-between; align-items:center; }
.hv-parts strong { font-variant-numeric:tabular-nums; }
.hist { list-style:none; margin:0; padding:0; display:grid; grid-template-columns:repeat(4, 1fr); gap:6px; }
.hist li { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:8px 6px; display:flex; flex-direction:column; align-items:center; text-align:center; line-height:1.35; }
.hist li.now { border-color:var(--accent); box-shadow:inset 0 0 0 1px var(--accent); }
.hist strong { font-size:1.125rem; font-variant-numeric:tabular-nums; }
.mv { font-size:.75rem; font-weight:700; } .mv.up { color:var(--ok-fg); } .mv.down { color:var(--bad-fg); } .mv.same { color:var(--muted); }
.hv-stats { display:grid; grid-template-columns:repeat(4, 1fr); gap:6px; }
.hv-stats div { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:8px 6px; display:flex; flex-direction:column; align-items:center; text-align:center; line-height:1.3; }
.hv-stats strong { font-size:1.125rem; font-variant-numeric:tabular-nums; }
table.weeks { font-size:.8125rem; border:1px solid var(--line); border-radius:var(--radius); border-collapse:separate; border-spacing:0; overflow:hidden; }
table.weeks th, table.weeks td { padding:6px 8px; }
table.weeks tr:last-child td { border-bottom:0; }
.ov-colors { display:flex; flex-wrap:wrap; align-items:center; gap:8px; color:inherit; text-decoration:none; }
.ov-color { display:inline-flex; align-items:baseline; gap:6px; padding:8px 14px; border-radius:14px; font-size:.9375rem; box-shadow:var(--shadow); }
.ov-color strong { font-size:1.375rem; font-variant-numeric:tabular-nums; }
.ov-color.xanh { background:var(--g-bg); color:var(--g-fg); } .ov-color.vang { background:var(--y-bg); color:var(--y-fg); } .ov-color.do { background:var(--r-bg); color:var(--r-fg); }
.trend { font-size:.75rem; font-weight:700; opacity:.85; } .trend.good { color:#15803D; } .trend.bad { color:#B91C1C; }
@media (prefers-color-scheme: dark) { .trend.good { color:#86EFAC; } .trend.bad { color:#FCA5A5; } }
/* Bảng theo đội: thành thẻ trên điện thoại */
@media (max-width: 640px) {
  .ov-teams thead { display:none; }
  .ov-teams, .ov-teams tbody { display:block; }
  .ov-teams tr { display:grid; grid-template-columns:1fr auto; gap:2px 10px; padding:10px 12px; border-bottom:1px solid var(--line); }
  .ov-teams td { border:0; padding:0; text-align:left !important; }
  .ov-teams td:nth-child(2) { text-align:right !important; font-size:1.0625rem; }
  .ov-teams td:nth-child(4)::before { content:"Nộp bài gần nhất: "; color:var(--muted); font-size:.8125rem; }
  .ov-teams td:nth-child(5)::before { content:"Có mặt: "; color:var(--muted); font-size:.8125rem; }
  .ov-teams td:nth-child(4), .ov-teams td:nth-child(5) { font-size:.875rem; }
  .ov-teams + * { margin-top:0; }
  .scroll:has(.ov-teams) { overflow:visible; }
}
.ov-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); gap:10px; margin:16px 0; }
.ov-grid .lbl { font-size:.8125rem; }
.ov-title { font-weight:600; line-height:1.35; margin:2px 0; }
.ov-teams td, .ov-teams th { white-space:nowrap; }
.mini { display:inline-block; min-width:1.8em; text-align:center; font-size:.75rem; font-weight:700; padding:1px 6px; border-radius:999px; margin-right:3px; }
.mini.xanh { background:var(--g-bg); color:var(--g-fg); } .mini.vang { background:var(--y-bg); color:var(--y-fg); } .mini.do { background:var(--r-bg); color:var(--r-fg); }
.ov-links { display:flex; flex-wrap:wrap; gap:8px; }
.ov-links a { display:inline-flex; align-items:center; min-height:44px; padding:8px 14px; border-radius:var(--radius); background:var(--card); border:1px solid var(--line); text-decoration:none; font-weight:600; }
.auth-box { max-width:400px; margin:0 auto; }
.auth-form { display:flex; flex-direction:column; gap:6px; margin:12px 0; }
.auth-form label { font-weight:600; font-size:.875rem; margin-top:6px; }
.auth-form input, .auth-form select, .admin-actions select { min-height:44px; font:16px var(--font); border:1px solid var(--line); border-radius:var(--radius); padding:8px 12px; background:var(--card); color:var(--fg); }
.auth-form button { margin-top:10px; }
a.btn { display:inline-flex; align-items:center; min-height:44px; padding:8px 16px; border-radius:var(--radius); background:var(--accent); color:var(--on-accent); text-decoration:none; font-weight:600; }
.code-box .code { font:700 1.75rem/1.2 ui-monospace, monospace; letter-spacing:.08em; margin:0; }
.admin-new { max-width:420px; }
.admin-actions { margin-top:8px; } .admin-actions summary { cursor:pointer; color:var(--accent); font-weight:600; }
.team-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(96px, 1fr)); gap:4px 8px; margin-bottom:8px; }
.plan-list { margin:2px 0 8px; padding-left:18px; } .plan-list li.future { color:var(--accent); font-weight:600; }
.team-pick select { min-height:36px; border:1px solid var(--line); border-radius:8px; padding:4px 8px; font:inherit; background:var(--card); color:var(--fg); }
.tchk { display:flex; align-items:center; gap:6px; min-height:36px; font-size:.875rem; }
.q-row { flex-wrap:wrap; }
.call-out { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; background:var(--warn-bg); color:var(--warn-fg); border-radius:var(--radius); padding:12px 14px; margin:10px 0; box-shadow:var(--shadow); }
.call-out.urgent { background:var(--bad-bg); color:var(--bad-fg); }
.call-out .btn { flex:none; }
.call-inline { color:var(--bad-fg); font-weight:600; }
.q-row .badge { font-size:.6875rem; padding:1px 8px; }
.chip .cnt { margin-left:6px; background:var(--bad-bg); color:var(--bad-fg); border-radius:999px; padding:0 6px; font-size:.75rem; font-weight:700; }
.week-setting { background:var(--card); border:1px solid var(--line); border-radius:var(--radius); padding:8px 12px; margin:8px 0 12px; font-size:.875rem; }
.week-setting summary { cursor:pointer; font-weight:600; }
.focus-form { max-width:520px; margin:6px 0 4px; } .focus-form select { flex:1; min-height:44px; border:1px solid var(--line); border-radius:var(--radius); padding:6px 10px; font:15px var(--font); background:var(--card); color:var(--fg); }
.card-item { background:var(--card); border:1px solid var(--line); border-radius:var(--radius); padding:12px 14px; margin:10px 0; }
.card-item summary { cursor:pointer; }
.qline { color:var(--muted); margin:4px 0 8px; }
.sd-img { display:block; max-width:360px; } .sd-img img { width:100%; max-height:420px; object-fit:contain; background:var(--soft); border-radius:10px; display:block; margin-bottom:6px; }
.crit { border:0; border-top:1px solid var(--line); margin:10px 0 0; padding:10px 0 0; }
.crit legend { font-weight:600; font-size:.9375rem; padding:0; }
.anchor { font-size:.75rem; color:var(--muted); margin:6px 0 0; line-height:1.45; }
.starset, .seg { display:flex; gap:6px; flex-wrap:wrap; margin-top:6px; }
.starset label, .seg label { flex:1; min-width:52px; }
.starset input, .seg input { position:absolute; opacity:0; width:1px; height:1px; }
.starset span, .seg span { display:flex; align-items:center; justify-content:center; min-height:44px; padding:4px 8px; border:1px solid var(--line); border-radius:10px; font-weight:700; font-size:.875rem; background:var(--bg); cursor:pointer; text-align:center; }
.starset input:checked + span { background:#F59E0B; border-color:#F59E0B; color:#1F1300; }
.seg input:checked + span { background:var(--accent); border-color:var(--accent); color:var(--on-accent); }
.starset input:focus-visible + span, .seg input:focus-visible + span { outline:3px solid var(--accent); outline-offset:2px; }
.sheet-form textarea, .sheet-form select { width:100%; min-height:44px; border:1px solid var(--line); border-radius:10px; padding:8px 10px; font:16px var(--font); background:var(--card); color:var(--fg); margin-top:6px; }
.qc { display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; }
.qc-btn { min-height:32px; padding:2px 10px; font-size:.75rem; background:transparent; color:var(--accent); border:1px dashed var(--accent); }
.written { margin:8px 0; } .written .answer { white-space:pre-wrap; font-size:.9375rem; background:var(--soft); border-radius:8px; padding:8px 10px; margin:0; }
.sheet-bar { position:sticky; bottom:0; display:flex; gap:8px; padding:10px 0; background:var(--bg); border-top:1px solid var(--line); margin-top:12px; }
.sheet-bar { flex-wrap:wrap; }
.sheet-bar .live { flex-basis:100%; display:flex; justify-content:space-between; gap:8px; font-size:.8125rem; color:var(--muted); }
.sheet-bar .live strong { color:var(--fg); }
.crit.missing { background:var(--bad-bg); border-radius:10px; padding:10px 8px 8px; margin-left:-8px; margin-right:-8px; }
.crit.missing legend::after { content:" — chưa chọn"; color:var(--bad-fg); font-weight:600; font-size:.8125rem; }
.sheet-bar button { flex:2; } .secondary-btn { flex:1; justify-content:center; background:var(--soft); color:var(--fg); border:1px solid var(--line); }
.g-stats { display:flex; flex-wrap:wrap; gap:4px 14px; margin-top:6px; font-size:.875rem; }
.qweeks { display:flex; flex-wrap:wrap; gap:4px; } .qweeks .mini { font-size:.8125rem; padding:2px 8px; }
/* ---- Bảng xếp hạng công khai ---- */
.bxh-hero { background:linear-gradient(135deg, #076A8F, #1D9195); color:#fff; border-radius:18px; padding:18px 18px 14px; margin:0 0 6px; box-shadow:var(--shadow); }
.bxh-hero h1 { color:#fff; margin:0 0 2px; font-size:1.625rem; }
.bxh-hero .eyebrow { margin:0; font-size:.75rem; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--orange); }
.bxh-hero p.small { margin:0 0 12px; opacity:.9; }
.dist { display:flex; height:12px; border-radius:999px; overflow:hidden; background:rgba(255,255,255,.25); gap:2px; }
.dist span { display:block; } .seg-xanh { background:#4ADE80; } .seg-vang { background:#FACC15; } .seg-do { background:#F87171; }
.dist-legend { display:flex; flex-wrap:wrap; gap:4px 14px; margin-top:8px; }
.dot { display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:6px; vertical-align:-1px; }
.dot.xanh { background:#4ADE80; } .dot.vang { background:#FACC15; } .dot.do { background:#F87171; }
.podium { display:grid; grid-template-columns:1fr 1.15fr 1fr; gap:8px; align-items:end; margin:12px auto 10px; max-width:620px; }
.pod { display:flex; flex-direction:column; align-items:center; text-align:center; gap:2px; padding:12px 8px 10px; border-radius:16px; text-decoration:none; color:inherit; box-shadow:var(--shadow); border:1px solid rgba(0,0,0,.04); min-width:0; }
.pod-1 { padding-top:18px; padding-bottom:16px; }
.pod .medal { width:34px; height:34px; border-radius:50%; display:grid; place-items:center; font-weight:800; color:#fff; margin-bottom:4px; }
.pod-1 .medal { background:linear-gradient(135deg,#F7C948,#E09F00); width:42px; height:42px; font-size:1.125rem; }
.pod-2 .medal { background:linear-gradient(135deg,#C9D3DA,#8FA0AB); } .pod-3 .medal { background:linear-gradient(135deg,#E8A273,#B8693A); }
.pod .pname { font-weight:700; font-size:.875rem; line-height:1.25; max-width:100%; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
.pod .pteam { font-size:.6875rem; opacity:.8; } .pod .ppct { font-weight:800; font-size:1.0625rem; font-variant-numeric:tabular-nums; }
.pod.xanh { background:var(--g-bg); color:var(--g-fg); } .pod.vang { background:var(--y-bg); color:var(--y-fg); } .pod.do { background:var(--r-bg); color:var(--r-fg); }
.search { position:sticky; top:68px; z-index:5; display:flex; align-items:center; gap:10px; background:var(--bg); padding:6px 0 8px; }
.search input { flex:1; min-height:44px; border:1px solid var(--line); border-radius:999px; padding:8px 16px 8px 40px; font:16px var(--font); color:var(--fg); background:var(--card) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' fill='none' stroke='%234B6573' stroke-width='2' stroke-linecap='round'%3E%3Ccircle cx='8' cy='8' r='6'/%3E%3Cpath d='m13 13 4 4'/%3E%3C/svg%3E") no-repeat 14px center; }
.rank-list > li[hidden] { display:none; }
/* Cửa sổ chi tiết: biểu đồ */
.rank-chart { width:100%; height:auto; max-height:110px; display:block; margin:2px 0 8px; }
.rank-chart .grid { stroke:var(--line); stroke-dasharray:3 4; } .rank-chart .lbl { font-size:9px; fill:var(--muted); }
.rank-chart .line { fill:none; stroke:var(--accent); stroke-width:2.5; stroke-linejoin:round; stroke-linecap:round; }
.rank-chart .pt { fill:var(--card); stroke:var(--accent); stroke-width:2; } .rank-chart .pt.now { fill:var(--orange); stroke:var(--orange); }
.wbars { display:flex; align-items:flex-end; gap:6px; height:130px; padding:6px 2px 0; margin:6px 0 4px; }
.wbar { flex:1; height:100%; display:flex; flex-direction:column; justify-content:flex-end; align-items:center; min-width:0; }
.wbar .wv { font-size:.625rem; font-weight:700; color:var(--muted); margin-bottom:2px; }
.wbar .wb { width:100%; max-width:30px; border-radius:6px 6px 2px 2px; }
.wbar .wb.xanh { background:#4ADE80; } .wbar .wb.vang { background:#FACC15; } .wbar .wb.do { background:#F87171; }
.wbar .wl { font-size:.625rem; color:var(--muted); margin-top:3px; white-space:nowrap; }
.weeks-table summary { cursor:pointer; color:var(--accent); font-weight:600; margin:4px 0; }
/* Điện thoại: cửa sổ chi tiết trượt lên từ đáy */
@media (max-width: 640px) {
  dialog.sheet { width:100%; max-width:100%; margin:auto 0 0; border-radius:18px 18px 0 0; max-height:90vh; }
  dialog.sheet[open] { animation:sheet-up .22s ease-out; }
  .sheet-body::before { content:""; display:block; width:40px; height:4px; border-radius:4px; background:var(--line); margin:-4px auto 10px; }
}
@keyframes sheet-up { from { transform:translateY(40px); opacity:.6; } to { transform:none; opacity:1; } }
/* Thông báo nổi sau khi lưu: hiện ở đáy màn hình rồi tự ẩn. */
.toast { width:max-content; position:fixed; left:50%; bottom:calc(84px + env(safe-area-inset-bottom)); transform:translateX(-50%); z-index:40; margin:0; max-width:min(520px, calc(100vw - 32px)); box-shadow:0 8px 24px rgba(11,59,78,.22); font-weight:600; animation:toast-in .25s ease-out, toast-out .4s ease-in 4s forwards; }
@media (min-width: 760px) { .toast { bottom:24px; } }
@keyframes toast-in { from { opacity:0; transform:translate(-50%, 12px); } to { opacity:1; transform:translate(-50%, 0); } }
@keyframes toast-out { to { opacity:0; transform:translate(-50%, 12px); visibility:hidden; } }
/* ---- Báo cáo ---- */
.rtable td, .rtable th { white-space:nowrap; } .rtable td { vertical-align:middle; }
.sbar { display:flex; width:140px; height:10px; border-radius:999px; overflow:hidden; background:var(--soft); gap:1px; vertical-align:middle; }
.s-ok { background:#22C55E; } .s-mid { background:#FACC15; } .s-bad { background:#F87171; } .s-empty { background:var(--soft); }
.meter { display:inline-flex; align-items:center; gap:8px; } .meter .sbar { width:110px; } .meter b { font-variant-numeric:tabular-nums; font-size:.875rem; min-width:3em; }
.rlegend { display:flex; align-items:center; gap:4px 10px; flex-wrap:wrap; } .sq { display:inline-block; width:10px; height:10px; border-radius:3px; }
.hbar { display:block; height:10px; border-radius:999px; background:var(--accent); }
.lsum th a { color:inherit; text-decoration:none; } .lsum th a.on { color:var(--accent); }
.lsum tr.rk-xanh td:first-child { box-shadow:inset 4px 0 0 #22C55E; } .lsum tr.rk-vang td:first-child { box-shadow:inset 4px 0 0 #FACC15; } .lsum tr.rk-do td:first-child { box-shadow:inset 4px 0 0 #F87171; }
.plist { list-style:none; margin:8px 0 0; padding:0; columns:2 220px; } .plist li { padding:3px 0; break-inside:avoid; }
@media (prefers-reduced-motion: reduce) { * { transition:none !important; animation:none !important; } }
`;

// Biểu tượng nét mảnh (vẽ theo kiểu Lucide, giấy phép ISC), dùng chung cho menu.
const ICON: Record<string, string> = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  db: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  chart: '<path d="M3 3v18h18M7 15l4-4 3 3 5-6"/>',
};
export function Icon(props: { name: string }) {
  return raw(
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[props.name] ?? ""}</svg>`,
  );
}

type NavItem = { href: string; label: string; icon: string };
const MAIN_NAV: NavItem[] = [
  { href: "/", label: "Tổng quan", icon: "home" },
  { href: "/nop-bai", label: "Nộp bài", icon: "inbox" },
  { href: "/cham", label: "Chấm bài", icon: "star" },
  { href: "/bang-xep-hang", label: "Xếp hạng", icon: "trophy" },
];
const MORE_NAV: NavItem[] = [
  { href: "/bao-cao", label: "Báo cáo thống kê", icon: "chart" },
  { href: "/canh-bao", label: "Cảnh báo", icon: "alert" },
  { href: "/du-lieu", label: "Dữ liệu", icon: "db" },
  { href: "/tai-khoan", label: "Tài khoản", icon: "user" },
  { href: "/quan-tri", label: "Quản trị (admin)", icon: "shield" },
];
const GRADER_NAV: NavItem[] = [
  { href: "/cham", label: "Bàn chấm", icon: "star" },
  { href: "/tai-khoan", label: "Tài khoản", icon: "user" },
];

// Đánh dấu mục đang mở (đường dẫn dài nhất khớp).
const ACTIVE_JS = `(()=>{const p=location.pathname;let best=null,len=-1;document.querySelectorAll('[data-nav]').forEach(a=>{const h=a.getAttribute('href');const ok=h==='/'?p==='/':(p===h||p.startsWith(h+'/'));if(ok&&h.length>len){best=h;len=h.length;}});if(best)document.querySelectorAll('[data-nav][href="'+best+'"]').forEach(a=>a.setAttribute('aria-current','page'));})();`;

export type Og = { title: string; description: string; url: string; image: string };

export function Layout(props: { title: string; children?: Child; publicPage?: boolean; nav?: "full" | "grader"; og?: Og }) {
  const grader = props.nav === "grader";
  const main = grader ? GRADER_NAV : MAIN_NAV;
  const withNav = !props.publicPage;
  return (
    <html lang="vi">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="robots" content="noindex" />
        <meta name="theme-color" content="#076A8F" />
        <title>{props.title} · NSKT 2026</title>
        <link rel="icon" type="image/png" href="/brand/favicon-64.png" />
        <link rel="apple-touch-icon" href="/brand/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        {props.og ? (
          <>
            <meta property="og:type" content="website" />
            <meta property="og:title" content={props.og.title} />
            <meta property="og:description" content={props.og.description} />
            <meta property="og:url" content={props.og.url} />
            <meta property="og:image" content={props.og.image} />
            <meta property="og:image:width" content="1200" />
            <meta property="og:image:height" content="630" />
            <meta name="twitter:card" content="summary_large_image" />
          </>
        ) : null}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap" />
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body class={withNav ? "has-bottom" : ""}>
        <header class="top">
          <div class="top-in">
            {props.publicPage ? (
              // Người xem công khai: logo chỉ là hình, không dẫn vào khu nội bộ.
              <span class="brand">
                <img src="/brand/logo.webp" alt="Nhân Sự Kế Thừa 2026" width="140" height="38" />
              </span>
            ) : (
              <a href={grader ? "/cham" : "/"} class="brand" aria-label="Nhân Sự Kế Thừa 2026 – trang chủ">
                <img src="/brand/logo.webp" alt="Nhân Sự Kế Thừa 2026" width="140" height="38" />
              </a>
            )}
            {withNav ? (
              <nav class="nav-top" aria-label="Menu chính">
                {main.map((n) => (
                  <a href={n.href} data-nav="">
                    <Icon name={n.icon} />
                    {n.label}
                  </a>
                ))}
                {grader ? null : (
                  <details class="nav-more">
                    <summary>
                      <Icon name="menu" />
                      Thêm
                    </summary>
                    <div class="menu">
                      {MORE_NAV.map((n) => (
                        <a href={n.href} data-nav="">
                          <Icon name={n.icon} />
                          {n.label}
                        </a>
                      ))}
                    </div>
                  </details>
                )}
              </nav>
            ) : null}
          </div>
        </header>
        <main>{props.children}</main>
        {withNav ? (
          <nav class="nav-bottom" aria-label="Menu">
            {main.map((n) => (
              <a href={n.href} class="nav-tab" data-nav="">
                <Icon name={n.icon} />
                {n.label}
              </a>
            ))}
            {grader ? null : (
              <details class="nav-more">
                <summary>
                  <Icon name="menu" />
                  Thêm
                </summary>
                <div class="menu">
                  {MORE_NAV.map((n) => (
                    <a href={n.href} data-nav="">
                      <Icon name={n.icon} />
                      {n.label}
                    </a>
                  ))}
                </div>
              </details>
            )}
          </nav>
        ) : null}
        {withNav ? <script dangerouslySetInnerHTML={{ __html: ACTIVE_JS }} /> : null}
      </body>
    </html>
  );
}
