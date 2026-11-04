const { _electron } = require('playwright');
const fs=require('fs'), cp=require('child_process');
const root='/tmp/deepnest-cnc-gui-acceptance';
const exe='/tmp/deepnest-acceptance-build/deepnest-v1.5.6-linux-x64/deepnest-v1.5.6';
fs.copyFileSync('/home/abd/Downloads/сфера/sphere_shelf_for_deepnest_Mspherical_W1200_H720_D160_R0_T12_v1.svg',root+'/native-input.svg');
const env={...process.env, DISPLAY:':97', XDG_SESSION_TYPE:'x11', WAYLAND_DISPLAY:'', HOME:root+'/home', XDG_CONFIG_HOME:root+'/config', XDG_CACHE_HOME:root+'/cache', SAVE_PLACEMENTS_PATH:root+'/run', DBUS_SESSION_BUS_ADDRESS:'', GTK_USE_PORTAL:'0', LD_LIBRARY_PATH:root+'/xdotool-root/usr/lib/x86_64-linux-gnu'};
const xd=root+'/xdotool-root/usr/bin/xdotool';
function keys(file) { return new Promise((resolve,reject)=>setTimeout(()=>{try {console.log('WINDOWS', cp.execFileSync(xd,['search','--name','.','getwindowname','%@'],{env,encoding:'utf8'})); cp.execFileSync(xd,['key','--clearmodifiers','ctrl+l'],{env}); cp.execFileSync(xd,['type','--clearmodifiers','--delay','1',file],{env}); cp.execFileSync(xd,['key','Return'],{env}); resolve();}catch(e){reject(e)}},4000)); }
(async()=>{let app;try {
 app=await _electron.launch({executablePath:exe,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage'],env,timeout:30000});
 const p=await app.firstWindow(); await p.waitForSelector('#config_tab',{timeout:30000}); await p.waitForFunction(()=>window.DeepNest);
 await p.click('#home_tab'); let k=keys(root+'/native-input.svg'); await p.click('#import'); await k; await p.waitForFunction(()=>window.DeepNest.parts.length===9,null,{timeout:30000}); console.log('NATIVE_OPEN_OK');
 await p.click('#addsheet'); await p.fill('#sheetwidth','2500'); await p.fill('#sheetheight','1250'); await p.click('#confirmsheet'); await p.click('#startnest'); await p.waitForFunction(()=>window.DeepNest.nests.some(n=>n.selected),null,{timeout:180000}); await p.click('#stopnest');
 const dest=root+'/native-dialog-output.dxf'; try {fs.unlinkSync(dest)} catch(e) {if(e.code!=='ENOENT') throw e;}
 await p.click('#export'); k=keys(dest); await p.locator('#exportcncdxf').click(); await k; for(let i=0;i<100&&!fs.existsSync(dest);i++) await new Promise(r=>setTimeout(r,100)); if(!fs.existsSync(dest)) throw Error('native save missing'); console.log('NATIVE_SAVE_OK',fs.statSync(dest).size);
}finally{if(app)await app.close();}})().catch(e=>{console.error(e);process.exitCode=1});
