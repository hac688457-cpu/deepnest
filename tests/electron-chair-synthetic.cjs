// Import real SVG in source Electron and export every part without running the solver.
const { _electron } = require('playwright');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = process.env.DEEPNEST_TEST_ROOT || '/tmp/deepnest-v160-chair-synthetic';
const svg = process.env.DEEPNEST_SVG || '/home/abd/Downloads/кресло/chair_for_deepnest_T18_D11_N16_v1.svg';
fs.mkdirSync(root, {recursive:true});
(async () => {
 let app;
 try {
  app = await _electron.launch({executablePath:process.env.DEEPNEST_APP, args:['--no-sandbox','--disable-gpu'], env:{...process.env, HOME:root, XDG_CONFIG_HOME:root, XDG_CACHE_HOME:root, SAVE_PLACEMENTS_PATH:root}, timeout:30000});
  const page = await app.firstWindow();
  await page.waitForFunction(()=>window.DeepNest && window.config);
  await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},svg);
  await page.click('#import');
  await page.waitForFunction(()=>window.DeepNest.imports.length===1, null, {timeout:60000});
  const result = await page.evaluate(() => {
   const parts = window.DeepNest.parts;
   const make = require('./cnc-dxf.js');
   const counts = parts.map(p=>p.svgelements.length);
   const sheet = {bounds:{x:0,y:0,width:1,height:1},svgelements:[]};
   const placements = parts.map((_,source)=>({source,x:0,y:0,rotation:0}));
   const rectangle = document.createElementNS('http://www.w3.org/2000/svg','rect');
   rectangle.setAttribute('x','0'); rectangle.setAttribute('y','0'); rectangle.setAttribute('width', String(10000*window.config.scale/25.4)); rectangle.setAttribute('height',String(5000*window.config.scale/25.4));
   const bordered = {...sheet, svgelements:[rectangle]};
   const two = {placements:[{sheet:parts.length,sheetplacements:placements.slice(0,37)},{sheet:parts.length,sheetplacements:placements.slice(37)}]};
   return {counts, dxf:make({placements:[{sheet:parts.length,sheetplacements:placements}]},[...parts,sheet],window.config.scale,false,0,window.SvgParser,GeometryUtil), off:make.sheets(two,[...parts,bordered],window.config.scale,false,window.SvgParser,GeometryUtil), on:make.sheets(two,[...parts,bordered],window.config.scale,true,window.SvgParser,GeometryUtil)};
  });
  assert.equal(result.counts.length,74); assert.equal(result.counts.reduce((a,b)=>a+b,0),256);
  fs.writeFileSync(path.join(root,'chair.dxf'),result.dxf);
  fs.writeFileSync(path.join(root,'counts.json'),JSON.stringify(result.counts));
  const save = require('../main/cnc-dxf-save.js');
  for (const mode of ['on','off']) {
   const dir = path.join(root, mode); fs.mkdirSync(dir,{recursive:true});
   for (const name of ['sheet_01.dxf','sheet_02.dxf']) fs.rmSync(path.join(dir,name),{force:true});
   save(dir,result[mode]);
   const before = result[mode].map((_,i)=>fs.readFileSync(path.join(dir,`sheet_0${i+1}.dxf`),'utf8'));
   assert.throws(()=>save(dir,result[mode]),/EEXIST/);
   assert.deepEqual(result[mode].map((_,i)=>fs.readFileSync(path.join(dir,`sheet_0${i+1}.dxf`),'utf8')),before);
  }
  console.log('CHAIR_SYNTHETIC_EXPORT',result.counts.length,result.counts.reduce((a,b)=>a+b,0));
 } finally { if(app) await app.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
