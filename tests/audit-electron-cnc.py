"""Audit the real Electron nesting output with ezdxf and shapely."""
import itertools
import json
import math
import sys
from pathlib import Path

import ezdxf
from shapely.geometry import Polygon, box

margin = float(sys.argv[1])
root = Path('/tmp/deepnest-cnc-gui-acceptance/output') / ('mixed' if len(sys.argv) > 2 and sys.argv[2] == 'mixed' else f'margin-{margin:g}' + ('-multi' if len(sys.argv) > 2 else ''))
data = json.loads((root / 'nest.json').read_text())
nest = next(n for n in data['nests'] if n['selected'])
sheets = nest['placements']
files = sorted(root.glob('sheet_*.dxf'))
assert len(files) == len(sheets)
for index, part in enumerate(data['parts']):
    if not part['sheet']:
        assert sum(p['source'] == index for s in sheets for p in s['sheetplacements']) == part['quantity']
for file, sheet in zip(files, sheets):
    doc = ezdxf.readfile(file)
    assert doc.dxfversion == 'AC1009' and not doc.audit().errors
    entities = list(doc.modelspace())
    placements = sheet['sheetplacements']
    assert len(entities) == sum(data['parts'][p['source']]['elements'] for p in placements)
    assert all(e.dxftype() == 'POLYLINE' and e.is_closed for e in entities)
    # This particular source has one closed, slotted outline per part.
    assert len(entities) == len(placements)
    polygons = [Polygon([(v.dxf.location.x, v.dxf.location.y) for v in e.vertices]) for e in entities]
    assert all(p.is_valid for p in polygons)
    physical = box(0, -1250, 2500, 0)
    assert all(physical.covers(p) for p in polygons)
    clearance = min(physical.boundary.distance(p) for p in polygons)
    spacing = min((a.distance(b) for a, b in itertools.combinations(polygons, 2)), default=math.inf)
    overlap = sum(a.intersection(b).area for a, b in itertools.combinations(polygons, 2))
    assert clearance >= margin - 0.001 and spacing >= 8 - 0.001 and overlap < 1e-6
    for e, placement in zip(entities, placements):
        source = data['parts'][placement['source']]['bounds']
        x = [v.dxf.location.x for v in e.vertices]
        y = [v.dxf.location.y for v in e.vertices]
        expected = sorted([source['width'] * 25.4 / 72, source['height'] * 25.4 / 72])
        actual = sorted([max(x) - min(x), max(y) - min(y)])
        assert all(math.isclose(a, b, abs_tol=0.05) for a, b in zip(actual, expected))
    print(f'{file.name}: AC1009, {len(entities)} closed contours; edge {clearance:.4f} mm, spacing {spacing:.4f} mm, overlap {overlap:.6f} mm²')
