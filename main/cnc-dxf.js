// Export the already cleaned SVG geometry in the same coordinates as the nest.
module.exports = function cncDxf(nest, parts, scale, withSheets, sheetGap, parser, geometry) {
    const mm = 25.4 / Number(scale);
    if (!Number.isFinite(mm) || mm <= 0) throw Error('Invalid drawing scale');
    const entities = [];
    let height = 0;
    const emit = (element, layer, transform, requireClosed) => {
        const tag = element.tagName.toLowerCase();
        let points = [], closed = false;
        const add = p => {
            if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) throw Error('Invalid geometry in ' + tag);
            const last = points[points.length - 1];
            if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 1e-9) points.push(p);
        };
        if (tag === 'path') {
            const path = element.cloneNode(false);
            parser.pathToAbsolute(path);
            let current = {x: 0, y: 0}, control, previous = '';
            const segs = path.pathSegList;
            for (let i = 0; i < segs.numberOfItems; i++) {
                const s = segs.getItem(i), cmd = s.pathSegTypeAsLetter.toUpperCase();
                const end = {x: 'x' in s ? s.x : current.x, y: 'y' in s ? s.y : current.y};
                let curve;
                switch (cmd) {
                    case 'M': if (points.length) throw Error('Compound path was not split on import'); add(end); break;
                    case 'L': case 'H': case 'V': add(end); break;
                    case 'C': case 'S': {
                        const c1 = cmd === 'C' ? {x:s.x1,y:s.y1} : /[CS]/.test(previous) ? {x:2*current.x-control.x,y:2*current.y-control.y} : current;
                        control = {x:s.x2,y:s.y2};
                        curve = geometry.CubicBezier.linearize(current, end, c1, control, 0.01/mm); break;
                    }
                    case 'Q': case 'T': {
                        control = cmd === 'Q' ? {x:s.x1,y:s.y1} : /[QT]/.test(previous) ? {x:2*current.x-control.x,y:2*current.y-control.y} : current;
                        curve = geometry.QuadraticBezier.linearize(current, end, control, 0.01/mm); break;
                    }
                    case 'A':
                        if (!s.r1 || !s.r2) add(end);
                        else if (current.x !== end.x || current.y !== end.y) curve = geometry.Arc.linearize(current, end, s.r1, s.r2, s.angle, s.largeArcFlag, s.sweepFlag, 0.005/mm);
                        break;
                    case 'Z': closed = true; break;
                    default: throw Error('Unsupported path command: ' + cmd);
                }
                if (curve) curve.forEach(add);
                if (cmd !== 'Z') current = end;
                previous = cmd;
            }
        } else if (tag === 'line') {
            add({x:Number(element.getAttribute('x1')), y:Number(element.getAttribute('y1'))});
            add({x:Number(element.getAttribute('x2')), y:Number(element.getAttribute('y2'))});
        } else if (['rect','circle','ellipse','polygon','polyline'].includes(tag)) {
            if (tag === 'rect' && (Number(element.getAttribute('rx')) || Number(element.getAttribute('ry')))) throw Error('Rounded rectangles must be converted to paths before import');
            const old = parser.conf.tolerance, oldSvg = parser.conf.toleranceSvg;
            try { parser.conf.tolerance = 0.01/mm; parser.conf.toleranceSvg = 1e-9; points = parser.polygonify(element); }
            finally { parser.conf.tolerance = old; parser.conf.toleranceSvg = oldSvg; }
            closed = tag !== 'polyline';
        } else throw Error('Unsupported SVG element: ' + tag);
        if (points.length > 1 && Math.hypot(points[0].x-points[points.length-1].x, points[0].y-points[points.length-1].y) < 1e-9) { points.pop(); closed = true; }
        if (requireClosed && !closed) throw Error('Open outer contour on ' + layer);
        if (points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) throw Error('Invalid geometry in ' + tag);
        if (points.length < (closed ? 3 : 2)) throw Error('Degenerate contour on ' + layer);
        const output = points.map(p => transform(p)).map(p => ({x:p.x*mm, y:-p.y*mm}));
        entities.push(['0','POLYLINE','8',layer,'66','1','70',closed ? '1' : '0','10','0','20','0','30','0', ...output.flatMap(p => ['0','VERTEX','8',layer,'10',String(p.x),'20',String(p.y),'30','0']), '0','SEQEND','8',layer].join('\n'));
    };
    nest.placements.forEach((sheet, sheetIndex) => {
        const source = parts[sheet.sheet], bounds = source.bounds;
        const sx = -bounds.x, sy = height - bounds.y;
        if (withSheets) source.svgelements.forEach((e, i) => emit(e, 'SHEET_BOUNDARIES', p => ({x:p.x+sx,y:p.y+sy}), i === 0));
        sheet.sheetplacements.forEach((placement, partIndex) => {
            const a = placement.rotation * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
            parts[placement.source].svgelements.forEach((e, i) => emit(e, `PART_${sheetIndex+1}_${partIndex+1}`, p => ({x:p.x*c-p.y*s+placement.x+sx, y:p.x*s+p.y*c+placement.y+sy}), i === 0));
        });
        height += bounds.height + (sheetIndex < nest.placements.length - 1 ? Number(sheetGap) : 0);
    });
    if (!entities.length) throw Error('No geometry to export');
    return ['0','SECTION','2','HEADER','9','$ACADVER','1','AC1009','0','ENDSEC','0','SECTION','2','ENTITIES',...entities,'0','ENDSEC','0','EOF',''].join('\n');
};

// Each non-empty sheet uses the same geometry conversion without the combined layout offset.
module.exports.sheets = function (nest, parts, scale, withSheets, parser, geometry) {
    return nest.placements.filter(sheet => sheet.sheetplacements.length).map(sheet =>
        module.exports({placements:[sheet]}, parts, scale, withSheets, 0, parser, geometry));
};
