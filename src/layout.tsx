import type { Child } from "hono/jsx";

const css = `
:root { color-scheme: light dark; --fg:#1c1c1a; --bg:#fafaf7; --muted:#6b6b66; --line:#deded8; --accent:#0b6e4f; }
@media (prefers-color-scheme: dark) { :root { --fg:#ecece6; --bg:#161614; --muted:#a0a09a; --line:#33332f; --accent:#5cc9a0; } }
* { box-sizing: border-box; }
body { margin:0; font:16px/1.55 system-ui, sans-serif; color:var(--fg); background:var(--bg); }
header { border-bottom:1px solid var(--line); padding:12px 16px; }
header a { color:var(--fg); font-weight:600; text-decoration:none; }
main { max-width:960px; margin:0 auto; padding:24px 16px; }
a { color:var(--accent); }
h1 { font-size:1.5rem; margin:0 0 12px; }
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
          <a href="/">nskt-hub</a>
        </header>
        <main>{props.children}</main>
      </body>
    </html>
  );
}
