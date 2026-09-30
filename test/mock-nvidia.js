// Mock NVIDIA NIM server for local end-to-end testing and sandbox previews
// where the real API (integrate.api.nvidia.com) is not reachable.
//
//   node test/mock-nvidia.js          → listens on 127.0.0.1:9999
//   NVIDIA_BASE_URL=http://127.0.0.1:9999/v1 npm run start
//
// Accepts any key that starts with "nvapi-". Replies are clearly labelled as
// simulated so it can never be confused with the real API.
const http = require('http');

const REPLY = [
  '**This is a simulated reply** — this sandbox preview cannot reach the real NVIDIA API, so a local mock is answering. ',
  'Once deployed on Vercel (no code changes needed), the exact same UI streams real answers from `build.nvidia.com` models.\n\n',
  'Meanwhile, here is a demo website so you can try the **Preview** tab and the sandboxed live render:\n\n',
  '```html\n',
  '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>Curious AI — Demo</title>\n<style>\n  * { box-sizing: border-box; margin: 0; }\n  body { font-family: system-ui, sans-serif; background: #0b0d10; color: #e7eaef; min-height: 100vh; display: flex; align-items: center; justify-content: center; }\n  .card { text-align: center; padding: 48px 40px; border-radius: 24px; background: linear-gradient(160deg, #14171e, #1b2410); border: 1px solid #2a3320; box-shadow: 0 30px 60px rgba(0,0,0,.5); max-width: 560px; }\n  .bolt { width: 64px; height: 64px; border-radius: 18px; background: #76b900; color: #101500; display: grid; place-items: center; margin: 0 auto 22px; font-size: 30px; }\n  h1 { font-size: 30px; letter-spacing: -.02em; margin-bottom: 10px; }\n  p { color: #98a2b3; margin-bottom: 22px; }\n  button { background: #76b900; color: #101500; border: 0; font: inherit; font-weight: 700; padding: 12px 26px; border-radius: 12px; cursor: pointer; transition: transform .1s; }\n  button:hover { transform: scale(1.05); }\n  #count { margin-top: 18px; color: #96d232; font-variant-numeric: tabular-nums; }\n</style>\n</head>\n<body>\n  <div class="card">\n    <div class="bolt">&#9889;</div>\n    <h1>Website preview works!</h1>\n    <p>This page was generated as one self-contained HTML file and is running in a sandboxed iframe.</p>\n    <button onclick="bump()">Click me — JS runs too</button>\n    <div id="count">clicks: 0</div>\n  </div>\n<script>\n  let n = 0;\n  function bump() { n++; document.getElementById("count").textContent = "clicks: " + n; }\n</script>\n</body>\n</html>\n',
  '```\n\n**Things to try in this preview:** the Code / Preview tabs above, the theme toggle in the sidebar, renaming this chat, and the Admin panel (sidebar → Admin) where unlimited `nvapi-…` keys are managed.',
].join('');

const server = http.createServer((req, res) => {
  if (req.url.endsWith('/models')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        data: [
          { id: 'mock/demo-stream' },
          { id: 'mock/demo-reasoner' },
        ],
      })
    );
    return;
  }
  if (req.url.endsWith('/chat/completions')) {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const auth = req.headers['authorization'] || '';
      if (!auth.startsWith('Bearer nvapi-')) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Invalid API key — the mock only accepts keys starting with nvapi-' } }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
      let i = 0;
      const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
      if (body.includes('demo-reasoner')) {
        // exercise the "thinking" UI once
        send({ choices: [{ delta: { reasoning_content: 'The user is chatting with the sandbox mock. I should stream a labelled demo answer with an HTML page so the preview feature can be tried. ' } }] });
      }
      const timer = setInterval(() => {
        if (i < REPLY.length) {
          const chunk = REPLY.slice(i, i + 12);
          i += 12;
          send({ choices: [{ delta: { content: chunk } }] });
        } else {
          clearInterval(timer);
          res.write('data: [DONE]\n\n');
          res.end();
        }
      }, 20);
    });
    return;
  }
  res.writeHead(404);
  res.end('not found');
});

server.listen(9999, '127.0.0.1', () => {
  console.log('mock NVIDIA API listening on http://127.0.0.1:9999');
});
