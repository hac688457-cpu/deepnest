// Exercise real GTK dialogs on an isolated X server; run inside dbus-run-session.
const { _electron } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const root = process.env.DEEPNEST_TEST_ROOT || '/tmp/deepnest-v160-native';
const exe = process.env.DEEPNEST_APP;
const svg = process.env.DEEPNEST_SVG || '/home/abd/Downloads/сфера/sphere_shelf_for_deepnest_Mspherical_W1200_H720_D160_R0_T12_v1.svg';
const xd = process.env.XDOTOOL || root + '/xdotool-root/usr/bin/xdotool';
if (!exe || !process.env.DBUS_SESSION_BUS_ADDRESS || ![':160', ':161'].includes(process.env.DISPLAY)) throw Error('Set DEEPNEST_APP and run under dbus-run-session on isolated DISPLAY :160 or :161');
for (const d of ['native-home', 'native-config', 'native-cache', 'native-run', 'native-runtime']) fs.mkdirSync(path.join(root, d), {recursive:true, mode:0o700});
const input = root + '/native-input.svg', output = root + '/native-dialog-output.dxf';
fs.copyFileSync(svg, input);
fs.rmSync(output, {force:true});
const env = {...process.env, XDG_SESSION_TYPE:'x11', WAYLAND_DISPLAY:'', HOME:root+'/native-home', XDG_CONFIG_HOME:root+'/native-config', XDG_CACHE_HOME:root+'/native-cache', XDG_RUNTIME_DIR:root+'/native-runtime', SAVE_PLACEMENTS_PATH:root+'/native-run', GTK_USE_PORTAL:'0', GSETTINGS_BACKEND:'memory', LD_LIBRARY_PATH:process.env.LD_LIBRARY_PATH || ''};
const xdo = (...args) => execFileSync(xd, args, {env, encoding:'utf8'}).trim();
async function enterPath(title, file) {
 const pattern = '^' + title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$';
 let id;
 for (let i=0; i<200 && !id; i++) {
  try { id = xdo('search', '--onlyvisible', '--name', pattern).split('\n').pop(); } catch (_) {}
  if (!id) await new Promise(r=>setTimeout(r,100));
 }
 if (!id) throw Error('GTK dialog did not appear: ' + title);
 console.log('GTK_DIALOG', title, id);
 await new Promise(r=>setTimeout(r,2000));
 xdo('windowraise', id);
 xdo('windowfocus', '--sync', id);
 xdo('key', '--clearmodifiers', 'ctrl+l');
 await new Promise(r=>setTimeout(r,500));
 xdo('type', '--clearmodifiers', '--delay', '50', file);
 await new Promise(r=>setTimeout(r,2000));
 const geometry = xdo('getwindowgeometry', '--shell', id);
 const width = Number(geometry.match(/^WIDTH=(\d+)$/m)[1]);
 const height = Number(geometry.match(/^HEIGHT=(\d+)$/m)[1]);
 xdo('windowraise', id);
 xdo('windowfocus', '--sync', id);
 xdo('mousemove', '--window', id, String(width - 50), String(height - 24));
 xdo('click', '1');
 await new Promise(r=>setTimeout(r,1000));
}
(async()=>{let app; try {
 app = await _electron.launch({executablePath:exe, args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage'], env, timeout:30000});
 await app.evaluate(({dialog}) => { const original = dialog.showOpenDialog; dialog.showOpenDialog = async (...args) => { const result = await original(...args); console.log('NATIVE_DIALOG_RESULT', JSON.stringify(result)); return result; }; });
 app.process().stdout.on('data', data => process.stdout.write(data));
 app.process().stderr.on('data', data => process.stderr.write(data));
 app.on('window', p => p.waitForURL('**/notification.html', {timeout:10000}).then(()=>p.close()).catch(()=>{}));
 const p = await app.firstWindow();
 await p.waitForSelector('#config_tab'); await p.waitForFunction(()=>window.DeepNest && window.config);
 await p.click('#config_tab'); await p.locator('#configform input[value=mm]').check();
 for (const [selector,value] of [['[data-config=spacing]','8'],['[data-config=sheetEdgeMargin]','4']]) { await p.locator(selector).fill(value); await p.locator(selector).blur(); }
 await p.click('#home_tab');
 await Promise.all([enterPath('Open Files', input), p.click('#import')]);
 try { await p.waitForFunction(()=>window.DeepNest.parts.length===14, null, {timeout:30000}); } catch (e) { console.log('IMPORT_STATE', await p.evaluate(()=>({parts:window.DeepNest.parts.length, imports:window.DeepNest.imports.length, button:document.querySelector('#import').className}))); throw e; } console.log('NATIVE_OPEN_OK');
 await p.click('#addsheet'); await p.fill('#sheetwidth','2500'); await p.fill('#sheetheight','1250'); await p.click('#confirmsheet');
 await p.click('#startnest'); await p.waitForFunction(()=>window.DeepNest.nests.some(n=>n.selected), null, {timeout:180000}); await p.click('#stopnest');
 await p.click('#export');
 await Promise.all([enterPath('Export CNC DXF R12 (mm)', output), p.locator('#exportcncdxf').click()]);
 for (let i=0;i<100&&!fs.existsSync(output);i++) await new Promise(r=>setTimeout(r,100));
 if (!fs.existsSync(output)) throw Error('Native save did not create output');
 console.log('NATIVE_SAVE_OK', fs.statSync(output).size);
} finally { if (app) await app.close(); }})().catch(e=>{console.error(e); process.exitCode=1;});
