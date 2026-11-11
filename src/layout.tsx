import type { Child } from "hono/jsx";

const css = `
:root { color-scheme: light dark; --fg:#1c1c1a; --bg:#fafaf7; --card:#fff; --muted:#6b6b66; --line:#deded8; --accent:#0b6e4f; --warn-bg:#fff4d6; --warn-fg:#6b4a00; --ok-bg:#e2f4ec; }
@media (prefers-color-scheme: dark) { :root { --fg:#ecece6; --bg:#161614; --card:#1f1f1c; --muted:#a0a09a; --line:#33332f; --accent:#5cc9a0; --warn-bg:#3a2f10; --warn-fg:#f3d58a; --ok-bg:#16332a; } }
* { box-sizing: border-box; }
body { margin:0; font:16px/1.55 system-ui, sans-serif; color:var(--fg); background:var(--bg); }
header { border-bottom:1px solid var(--line); padding:12px 16px; display:flex; gap:20px; flex-wrap:wrap; align-items:baseline; }
header a { color:var(--fg); text-decoration:none; }
header a.brand { font-weight:700; }
main { max-width:960px; margin:0 auto; padding:24px 16px; }
a { color:var(--accent); }
h1 { font-size:1.5rem; margin:0 0 12px; }
h2 { font-size:1.1rem; margin:28px 0 8px; }
.muted { color:var(--muted); }
.warn, .notice { padding:10px 12px; border-radius:8px; }
.warn { background:var(--warn-bg); color:var(--warn-fg); }
.notice { background:var(--ok-bg); }
.tiles { display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:10px; margin:16px 0; }
.tile { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:12px; }
.tile .num { font-size:1.6rem; font-weight:700; font-variant-numeric:tabular-nums; }
.tile .lbl { color:var(--muted); font-size:.9rem; }
table { border-collapse:collapse; width:100%; font-size:.93rem; }
th, td { text-align:left; padding:6px 10px; border-bottom:1px solid var(--line); vertical-align:top; }
th { color:var(--muted); font-weight:600; white-space:nowrap; }
td:first-child { white-space:nowrap; }
td.r { text-align:right; font-variant-numeric:tabular-nums; }
.scroll { overflow-x:auto; }
.actions { display:flex; gap:10px; flex-wrap:wrap; }
button { font:inherit; padding:8px 14px; border-radius:8px; border:1px solid var(--accent); background:var(--accent); color:var(--bg); cursor:pointer; }
button.secondary { background:transparent; color:var(--accent); }
code { font-size:.9em; }
`;

export function Layout(props: { title: string; children?: Child }) {
  return (
    <html lang="vi">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
        <title>{props.title} · nskt-hub</title>
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
