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
header { background:var(--card); border-bottom:1px solid var(--line); padding:10px 16px; display:flex; gap:4px 16px; flex-wrap:wrap; align-items:center; }
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
@media (prefers-reduced-motion: reduce) { * { transition:none !important; animation:none !important; } }
`;

export function Layout(props: { title: string; children?: Child }) {
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
          <a href="/" class="brand">
            nskt-hub
          </a>
          <a href="/du-lieu">Tình trạng dữ liệu</a>
        </header>
        <main>{props.children}</main>
      </body>
    </html>
  );
}
