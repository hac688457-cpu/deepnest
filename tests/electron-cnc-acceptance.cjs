// Packaged Electron acceptance; all generated files stay in the dedicated temporary directory.
const { _electron } = require('playwright');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = '/tmp/deepnest-cnc-gui-acceptance';
const appPath = process.env.DEEPNEST_APP || '/tmp/deepnest-acceptance-build/deepnest-v1.5.6-linux-x64/deepnest-v1.5.6';
const svg = process.env.DEEPNEST_SVG || '/home/abd/Downloads/сфера/sphere_shelf_for_deepnest_Mspherical_W1200_H720_D160_R0_T12_v1.svg';
const margin = Number(process.env.MARGIN || 4);
const out = path.join(root, 'output', process.env.MIXED ? 'mixed' : `margin-${margin}${process.env.MULTI ? '-multi' : ''}`);
fs.mkdirSync(out, {recursive:true});
for (const name of fs.readdirSync(out)) if (/^(sheet_\d+\.dxf|combined\.dxf|console\.log|dialogs\.log|failure\.png)$/.test(name)) fs.unlinkSync(path.join(out,name));
for (const d of ['home','config','cache','run']) fs.mkdirSync(path.join(root,d), {recursive:true});
(async () => {
 let app, page;
 try {
  app = await _electron.launch({executablePath:appPath, args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage'], timeout:30000, env:{...process.env, DISPLAY:process.env.DISPLAY || ':97', XDG_SESSION_TYPE:'x11', WAYLAND_DISPLAY:'', ELECTRON_DISABLE_GPU:'1', HOME:path.join(root,'home'), XDG_CONFIG_HOME:path.join(root,'config'), XDG_CACHE_HOME:path.join(root,'cache'), SAVE_PLACEMENTS_PATH:path.join(root,'run')}});
  app.on('window', p => {p.on('console', m => fs.appendFileSync(path.join(out,'console.log'), `${m.type()} ${m.text()}\n`)); p.on('pageerror', e => fs.appendFileSync(path.join(out,'console.log'), `ERROR ${e.stack}\n`));});
  page = await app.firstWindow();
  await page.waitForSelector('#config_tab', {timeout:30000});
  await page.waitForFunction(() => window.config && window.DeepNest, null, {timeout:30000});
  await app.evaluate(async ({BrowserWindow}) => {const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('index.html')); if (!w.isVisible()) await new Promise(r=>w.once('ready-to-show',r));});
  assert(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().some(w=>w.isVisible() && w.webContents.getURL().includes('index.html'))));
  await page.click('#config_tab');
  await page.locator('#configform input[value=mm]').check();
  for (const [selector,value] of [['[data-config=spacing]','8'],['[data-config=sheetEdgeMargin]',String(margin)]]) {await page.locator(selector).fill(value); await page.locator(selector).blur();}
  assert(Math.abs(Number(await page.locator('[data-config=sheetEdgeMargin]').inputValue()) - margin) < 1e-9);
  await page.screenshot({path:path.join(out,'settings.png')});
  await page.click('#home_tab');
  const files = process.env.MIXED ? [
    'sphere_shelf_for_deepnest_Mconstant_W1700_H1700_D250_R30_T12_v1.svg',
    'sphere_shelf_for_deepnest_Mspherical_W1200_H720_D160_R0_T12_v1.svg',
    'sphere_shelf_for_deepnest_Mspherical_W1500_H900_D200_R0_T12_v1.svg'
  ].map(name => path.join('/home/abd/Downloads/сфера', name)) : [svg];
  for (const [i, file] of files.entries()) {
    await app.evaluate(({dialog}, file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},file);
    await page.click('#import');
    await page.waitForFunction(count=>window.DeepNest.imports.length===count, i+1,{timeout:60000});
  }
  if (process.env.MIXED) assert.equal(await page.evaluate(()=>window.DeepNest.parts.length), 32);
  console.log('Imported:',await page.evaluate(()=>window.DeepNest.parts.length));
  await page.click('#addsheet'); await page.fill('#sheetwidth','2500'); await page.fill('#sheetheight','1250'); await page.click('#confirmsheet');
  if (process.env.MIXED) {
    const input = page.locator('#parts tbody input[type=number]').last();
    await input.fill('32'); await input.blur();
  }
  if (process.env.MULTI) {
    for (const input of await page.locator('#parts tbody input[type=number]').all()) { await input.fill(process.env.MULTI); await input.blur(); }
  }
  await page.screenshot({path:path.join(out,'import.png')});
  await page.click('#startnest');
  await page.waitForFunction(()=>window.DeepNest.nests.length>0, null,{timeout:180000});
  await page.waitForFunction(()=>window.DeepNest.nests.some(n=>n.selected), null,{timeout:10000});
  await page.click('#stopnest');
  const data = await page.evaluate(()=>({nests:window.DeepNest.nests, parts:window.DeepNest.parts.map(p=>({sheet:p.sheet,quantity:p.quantity,bounds:p.bounds,elements:p.svgelements?.length}))}));
  fs.writeFileSync(path.join(out,'nest.json'),JSON.stringify(data,null,2));
  console.log('Result:',JSON.stringify({parts:data.parts.length,sheets:data.nests[0].placements.length,placed:data.nests[0].placements.map(s=>s.sheetplacements.length)}));
  await page.screenshot({path:path.join(out,'nest.png')});
  await app.evaluate(({dialog},dir)=>{dialog.showSaveDialogSync=()=>dir+'/combined.dxf'; dialog.showOpenDialogSync=()=>[dir]; dialog.showMessageBoxSync=o=>{require('fs').appendFileSync(dir+'/dialogs.log',JSON.stringify(o)+'\n'); return 0;};},out);
  await page.click('#export'); await page.locator('#exportcncdxf').click();
  await page.click('#export'); await page.locator('#exportcncdxfsheets').click();
  assert(fs.existsSync(path.join(out,'combined.dxf')));
  assert(fs.existsSync(path.join(out,'sheet_01.dxf')));
  console.log('Export:',fs.readdirSync(out).filter(x=>x.endsWith('.dxf')));
 } catch(e) {if(page) await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{}); throw e;} finally {if(app) await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
