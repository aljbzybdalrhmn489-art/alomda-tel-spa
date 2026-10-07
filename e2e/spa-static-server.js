// SPA ↔ Backend Integration V1 — minimal static server for the E2E run.
// Serves spa_app-175.html with one tiny injected <script> setting
// window.OMDA_API_BASE_URL BEFORE the SPA's own <script> runs — exactly
// the environment-configuration seam the SPA's own BACKEND INTEGRATION
// LAYER documents (no build step, no bundler: a global set before load
// is the whole mechanism). The SPA file itself is never modified on disk.
//
// RUNTIME PROFILE: the SPA is production unless `window.OMDA_RUNTIME_PROFILE === "development"` (fail-safe default). The existing
// specs need the local demo / offline surface, so `/` is served with the development profile injected; `/production` is served
// EXACTLY as a production deployment would serve it (API base URL only, no profile) so the production specs prove the default.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const spaPath = path.resolve(__dirname, '..', 'spa_app-175.html');
const apiBaseUrl = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:4000';

// SAME-ORIGIN TOPOLOGY (the recommended production shape: one origin serves the SPA and reverse-proxies /api/ to the backend). The
// `/same-origin` page is served with NOTHING injected (no API base URL, no profile): the SPA then calls "/api/v1/..." on its own origin,
// and this server forwards those calls to the backend — exactly what a production reverse proxy does. No CORS is involved.
function proxyToBackend(req, res) {
  const target = new URL(apiBaseUrl);
  const upstream = http.request({ hostname: target.hostname, port: target.port, path: req.url, method: req.method, headers: { ...req.headers, host: target.host } }, (up) => {
    res.writeHead(up.statusCode || 502, up.headers);
    up.pipe(res);
  });
  upstream.on('error', () => { res.writeHead(502, { 'Content-Type': 'text/plain' }); res.end('bad gateway'); });
  req.pipe(upstream);
}

const server = http.createServer((req, res) => {
  const urlPath = (req.url || '').split('?')[0];
  if (urlPath.startsWith('/api/') || urlPath === '/health') { proxyToBackend(req, res); return; }
  const productionPath = urlPath === '/production';
  const sameOriginPath = urlPath === '/same-origin';
  let html;
  try {
    html = fs.readFileSync(spaPath, 'utf8');
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('SPA file not found: ' + spaPath);
    return;
  }
  const injected = sameOriginPath ? html : html.replace(
    '<script>',
    '<script>window.OMDA_API_BASE_URL = ' + JSON.stringify(apiBaseUrl) + ';' + (productionPath ? '' : ' window.OMDA_RUNTIME_PROFILE = "development";') + '</script>\n<script>',
  );
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(injected);
});

server.listen(4173, '127.0.0.1', () => {
  process.stdout.write('spa-static-server: listening on http://127.0.0.1:4173 (backend base url: ' + apiBaseUrl + ')\n');
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
