const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const make = require('../main/cnc-dxf.js');
const context = {};
vm.runInNewContext(fs.readFileSync('main/util/geometryutil.js', 'utf8'), context);
const geometry = context.GeometryUtil;
const path = segments => ({tagName:'path', cloneNode() { return this; }, pathSegList:{numberOfItems:segments.length, getItem:i => segments[i]}});
const seg = (command, props = {}) => ({pathSegTypeAsLetter:command, ...props});
const rectangle = (x,y,w,h) => path([seg('M',{x,y}),seg('L',{x:x+w,y}),seg('L',{x:x+w,y:y+h}),seg('L',{x,y:y+h}),seg('Z')]);
const factor = 72/25.4;
const parts = [
  {bounds:{x:0,y:0,width:2480*factor,height:1230*factor},svgelements:[rectangle(0,0,2480*factor,1230*factor)]},
  {svgelements:[rectangle(0,0,250*factor,100*factor),rectangle(20*factor,10*factor,12*factor,30*factor)]},
];
const nest = {placements:[{sheet:0,sheetplacements:[{source:1,x:100*factor,y:200*factor,rotation:0},{source:1,x:600*factor,y:100*factor,rotation:90}]}]};
const parser = {pathToAbsolute(){},conf:{}};
const dxf = make(nest, parts, 72, true, 0, parser, geometry);
assert.match(dxf, /\$ACADVER\n1\nAC1009/);
assert.equal((dxf.match(/\nPOLYLINE\n/g)||[]).length, 5);
assert.equal((dxf.match(/\nSHEET_BOUNDARIES\n66\n1/g)||[]).length, 1);
assert.equal((dxf.match(/\nPART_1_1\n66\n1/g)||[]).length, 2);
assert.equal((dxf.match(/\nPART_1_2\n66\n1/g)||[]).length, 2);
assert.doesNotMatch(dxf, /\n(?:SPLINE|LWPOLYLINE)\n/);
assert.equal((make(nest,parts,72,false,0,parser,geometry).match(/\nPOLYLINE\n/g)||[]).length,4);
const arc = path([seg('M',{x:0,y:0}),seg('A',{x:factor*20,y:0,r1:factor*10,r2:factor*10,angle:0,largeArcFlag:0,sweepFlag:1}),seg('L',{x:0,y:0})]);
const curved = make({placements:[{sheet:0,sheetplacements:[{source:2,x:0,y:0,rotation:0}]}]}, [...parts,{svgelements:[arc]}],72,false,0,parser,geometry);
assert.ok((curved.match(/\nVERTEX\n/g)||[]).length > 10);
fs.writeFileSync(process.argv[2] || '/tmp/deepnest-cnc-test.dxf', dxf);
console.log('CNC_DXF_TEST_OK');

const open = path([seg('M',{x:0,y:0}),seg('L',{x:10,y:0})]);
assert.throws(() => make({placements:[{sheet:0,sheetplacements:[{source:2,x:0,y:0,rotation:0}]}]}, [...parts,{svgelements:[open]}],72,false,0,parser,geometry), /Open outer contour/);
