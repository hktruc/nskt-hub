import type { Child } from "hono/jsx";

const css = `
:root { color-scheme: light dark;
  --bg:#F0FDFA; --card:#FFFFFF; --fg:#134E4A; --muted:#475569; --line:#CCEFEA; --soft:#E6F6F3;
  --accent:#0D9488; --on-accent:#FFFFFF;
  --ok-bg:#E7F7EF; --ok-fg:#166534; --warn-bg:#FFF1E7; --warn-fg:#9A3412; --bad-bg:#FDECEC; --bad-fg:#B91C1C;
  --radius:12px; --font:"Be Vietnam Pro", system-ui, sans-serif; }
@media (prefers-color-scheme: dark) { :root {
  --bg:#0F1C1B; --card:#172826; --fg:#E6F4F1; --muted:#9DB3B0; --line:#2A403D; --soft:#1D3532;
  --accent:#2DD4BF; --on-accent:#04201D;
  --ok-bg:#12342A; --ok-fg:#86EFAC; --warn-bg:#3A2412; --warn-fg:#FDBA74; --bad-bg:#3A1616; --bad-fg:#FCA5A5; } }
* { box-sizing:border-box; }
body { margin:0; font:16px/1.55 var(--font); color:var(--fg); background:var(--bg); }
header { background:var(--card); border-bottom:1px solid var(--line); padding:6px 16px; display:flex; gap:0 14px; flex-wrap:wrap; align-items:center; }
header a { color:var(--fg); text-decoration:none; min-height:44px; display:inline-flex; align-items:center; }
header a.brand { font-weight:700; color:var(--accent); margin-right:auto; }
main { max-width:960px; margin:0 auto; padding:20px 16px 32px; }
a { color:var(--accent); }
h1 { font-size:1.375rem; line-height:1.3; margin:0 0 12px; }
h2 { font-size:1.125rem; margin:28px 0 8px; }
.muted { color:var(--muted); }
.warn, .notice { padding:12px 14px; border-radius:var(--radius); }
.warn { background:var(--warn-bg); color:var(--warn-fg); }
.notice { background:var(--ok-bg); color:var(--ok-fg); }
.tiles { display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:10px; margin:16px 0; }
.tile { background:var(--card); border:1px solid var(--line); border-radius:var(--radius); padding:12px 14px; }
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
.tchk { display:flex; align-items:center; gap:6px; min-height:36px; font-size:.875rem; }
@media (prefers-reduced-motion: reduce) { * { transition:none !important; animation:none !important; } }
`;

export function Layout(props: { title: string; children?: Child; publicPage?: boolean; nav?: "full" | "grader" }) {
  return (
    <html lang="vi">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
        <meta name="theme-color" content="#0D9488" />
        <title>{props.title} · nskt-hub</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap" />
        <style dangerouslySetInnerHTML={{ __html: css }} />
      </head>
      <body>
        <header>
          <a href={props.publicPage ? "/bang-xep-hang" : props.nav === "grader" ? "/cham" : "/"} class="brand">
            nskt-hub
          </a>
          {props.publicPage ? null : props.nav === "grader" ? (
            <>
              <a href="/cham">Bàn chấm</a>
              <a href="/tai-khoan">Tài khoản</a>
            </>
          ) : (
            <>
              <a href="/nop-bai">Nộp bài</a>
              <a href="/bang-xep-hang">Xếp hạng</a>
              <a href="/canh-bao">Cảnh báo</a>
              <a href="/du-lieu">Dữ liệu</a>
              <a href="/tai-khoan">Tài khoản</a>
            </>
          )}
        </header>
        <main>{props.children}</main>
      </body>
    </html>
  );
}
