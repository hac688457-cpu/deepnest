const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const read = p => fs.readFileSync(p, 'utf8');
const context = vm.createContext({console, require, process, setInterval: f => { context.tick = f; return 1; }, window: {SvgParser: {config() {}}}});
context.ipcRenderer = {send() {}}; context.self = context; context.navigator = {userAgent:"node"};
vm.runInContext(read('main/util/clipper.js'), context);
vm.runInContext(read('main/util/geometryutil.js'), context);
context.addon = require('@deepnest/calculate-nfp');
context.window.db = {find() { return null; }, insert() {}};
vm.runInContext(read('main/deepnest.js').replace(/^import .*;$/gm, '').replaceAll('export class ', 'class ') + '\nthis.DeepNest = DeepNest;', context);
vm.runInContext(read('main/background.js').replace(/^import .*;$/gm, '') + '\nthis.placeParts = placeParts;', context);
let f = 72 / 25.4;
const rect = (w, h) => [{x:0,y:0},{x:w*f,y:0},{x:w*f,y:h*f},{x:0,y:h*f}];
for (const scale of [72, 90]) for (const [width, height, quantity, rotation] of [[1000,500,1,0], [1000,500,1,90], [2450,1200,2,0]]) for (const margin of [0, 4, 10]) {
  f = scale / 25.4;
  let prepared;
  const nest = new context.DeepNest({on() {}});
  nest.config({scale, spacing:8*f, sheetEdgeMargin:margin/25.4, rotations:4, mergeLines:false});
  nest.parts = [{sheet:true, quantity:2, polygontree:rect(2500,1250)}, {quantity, polygontree:rect(width,height)}];
  nest.launchWorkers = (parts, config) => { prepared = {parts, config}; };
  nest.start(); context.tick();
  const sheet = prepared.parts[0].polygontree;
  const part = prepared.parts[1].polygontree;
  const sb = context.GeometryUtil.getPolygonBounds(sheet);
  const pb = context.GeometryUtil.getPolygonBounds(part);
  const correction = margin - 4;
  for (const actual of [sb.x/f, sb.y/f, 2500-(sb.x+sb.width)/f, 1250-(sb.y+sb.height)/f]) {
    assert.ok(Math.abs(actual-correction) < 0.05, `sheet edge correction: ${actual}`);
  }
  assert.ok(Math.abs((pb.width/f-width)-8) < 0.05, 'part spacing must remain 8mm');
  const sheets = [0,1].map(i => Object.assign(sheet.slice(), {id:i,source:0,children:sheet.children}));
  const parts = Array.from({length:quantity}, (_, i) => i).map(i => Object.assign(part.slice(), {id:i,source:1,rotation,children:part.children}));
  const result = context.placeParts(sheets, parts, prepared.config, 0);
  assert.equal(result.placements.length, quantity);
  for (const placed of result.placements) {
    assert.ok(placed.sheetplacements.length >= 1);
    const p = placed.sheetplacements[0];
    assert.equal(p.rotation, rotation);
    const rad = p.rotation * Math.PI / 180;
    const points = rect(width,height).map(q => ({x:(q.x*Math.cos(rad)-q.y*Math.sin(rad)+p.x)/f, y:(q.x*Math.sin(rad)+q.y*Math.cos(rad)+p.y)/f}));
    const xs = points.map(q => q.x), ys = points.map(q => q.y);
    const edges = [Math.min(...xs), 2500-Math.max(...xs), Math.min(...ys), 1250-Math.max(...ys)];
    assert.ok(edges.every(x => x >= margin - 0.05), `${margin}mm rotation ${rotation}: ${edges}`);
    assert.ok(Math.abs(Math.min(...edges)-margin) < 0.05, `${margin}mm rotation ${rotation}: ${edges}`);
  }
}
const invalid = new context.DeepNest({on() {}});
invalid.config({scale:72, sheetEdgeMargin:4/25.4});
for (const value of [null, false, [], '', -1, 'Infinity']) {
  invalid.config({scale:72, sheetEdgeMargin:value});
  assert.ok(Math.abs(invalid.config().sheetEdgeMargin - 4*72/25.4) < 1e-9);
}
invalid.config({scale:72, spacing:0, sheetEdgeMargin:1000/25.4});
invalid.parts = [{sheet:true, quantity:1, polygontree:rect(100,100)}];
assert.throws(() => invalid.start(), /margin leaves an invalid/);
console.log('SHEET_MARGIN_SOLVER_OK');
