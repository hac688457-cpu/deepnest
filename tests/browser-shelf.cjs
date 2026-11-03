const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {stripTypeScriptTypes} = require('node:module');

const root = path.resolve(__dirname, '..');
const input = process.argv[2];
const output = process.argv[3] || '/tmp/deepnest-shelf-browser.dxf';
if (!input) throw Error('Usage: node tests/browser-shelf.cjs /absolute/path/shelf.svg [output.dxf]');
assert.ok(path.isAbsolute(input));
assert.notEqual(path.resolve(input), path.resolve(output), 'Output must not overwrite the input');
const svg = fs.readFileSync(input);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'deepnest-chrome-'));
const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let data, type = 'text/javascript';
    if (url.pathname === '/') { data = fs.readFileSync(path.join(__dirname, 'browser-shelf.html')); type = 'text/html'; }
    else if (url.pathname === '/source.svg') { data = svg; type = 'image/svg+xml'; }
    else if (/^\/build\/util\/(matrix|point|vector|HullPolygon|domparser)\.js$/.test(url.pathname)) {
      const file = path.join(root, 'main/util', path.basename(url.pathname, '.js') + '.ts');
      data = stripTypeScriptTypes(fs.readFileSync(file, 'utf8'), {mode:'transform'});
    } else if (/^\/main\/(svgparser|deepnest|cnc-dxf|util\/(pathsegpolyfill|clipper|geometryutil))\.js$/.test(url.pathname)) data = fs.readFileSync(path.join(root, url.pathname));
    else { res.writeHead(404); return res.end(); }
    res.writeHead(200, {'Content-Type':type}); res.end(data);
  } catch (error) { res.writeHead(500); res.end(String(error)); }
});
server.listen(0, '127.0.0.1', () => {
  const chrome = spawn('/usr/bin/google-chrome', ['--headless','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check',`--user-data-dir=${profile}`,'--virtual-time-budget=30000','--dump-dom',`http://127.0.0.1:${server.address().port}/`]);
  let stdout = '', stderr = '';
  chrome.stdout.on('data', data => stdout += data);
  chrome.stderr.on('data', data => stderr += data);
  const timer = setTimeout(() => chrome.kill('SIGKILL'), 60000);
  chrome.on('error', error => { console.error(error); process.exitCode = 1; });
  chrome.on('close', code => {
    clearTimeout(timer); server.close(); fs.rmSync(profile, {recursive:true,force:true});
    try {
      assert.equal(code, 0, `Chrome failed or timed out: ${stderr}`);
      const match = stdout.match(/<pre id="result">([^<]+)<\/pre>/);
      assert.ok(match, 'Browser did not produce a result DOM');
      const result = JSON.parse(match[1].replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>'));
      assert.equal(result.ok, true, result.error || 'Browser JavaScript did not finish');
      fs.writeFileSync(output, Buffer.from(result.dxf, 'base64'));
      delete result.dxf;
      console.log('BROWSER_SHELF_OK', JSON.stringify(result), output);
    } catch (error) { console.error(error); process.exitCode = 1; }
  });
});
