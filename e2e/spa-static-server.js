// SPA ↔ Backend Integration V1 — minimal static server for the E2E run.
// Serves spa_app-175.html with one tiny injected <script> setting
// window.OMDA_API_BASE_URL BEFORE the SPA's own <script> runs — exactly
// the environment-configuration seam the SPA's own BACKEND INTEGRATION
// LAYER documents (no build step, no bundler: a global set before load
// is the whole mechanism). The SPA file itself is never modified on disk.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const spaPath = path.resolve(__dirname, '..', 'spa_app-175.html');
const apiBaseUrl = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:4000';

const server = http.createServer((req, res) => {
  let html;
  try {
    html = fs.readFileSync(spaPath, 'utf8');
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('SPA file not found: ' + spaPath);
    return;
  }
  const injected = html.replace(
    '<script>',
    '<script>window.OMDA_API_BASE_URL = ' + JSON.stringify(apiBaseUrl) + ';</script>\n<script>',
  );
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(injected);
});

server.listen(4173, '127.0.0.1', () => {
  process.stdout.write('spa-static-server: listening on http://127.0.0.1:4173 (backend base url: ' + apiBaseUrl + ')\n');
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
