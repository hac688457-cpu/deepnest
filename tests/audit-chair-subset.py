"""Independently check the placed chair subset against its original SVG paths."""
import json, math, os
from pathlib import Path
import xml.etree.ElementTree as ET
import ezdxf, numpy as np, shapely
from scipy.optimize import linear_sum_assignment
from shapely.geometry import LineString, Polygon, box
from svgpathtools import parse_path

root = Path(os.environ['DEEPNEST_TEST_ROOT']) / 'output/margin-4'
svg = ET.parse(os.environ['DEEPNEST_SVG']).getroot()
groups = [g.findall('{http://www.w3.org/2000/svg}path') for g in svg]
data = json.loads((root/'nest.json').read_text())
nest = next(n for n in data['nests'] if n['selected'])
assert len(groups) == 3 and sum(map(len, groups)) == 13
polygons, worst, seen = [], 0, set()
for sheet_no, sheet in enumerate(nest['placements'], 1):
    doc = ezdxf.readfile(root/f'sheet_{sheet_no:02}.dxf')
    assert doc.dxfversion == 'AC1009' and not doc.audit().errors
    entities = list(doc.modelspace()); offset = 0
    for placement in sheet['sheetplacements']:
        index = placement['source']; assert index not in seen; seen.add(index)
        count = len(groups[index]); assert data['parts'][index]['elements'] == count
        current = entities[offset:offset+count]; offset += count
        assert len(current) == count and all(e.dxftype() == 'POLYLINE' and e.is_closed and e.dxf.layer == 'PART_OUTLINES' for e in current)
        actual = []
        for e in current:
            xy = [(v.dxf.location.x,v.dxf.location.y) for v in e.vertices]
            actual.append(LineString(xy + xy[:1]))
        expected = []
        angle = -math.radians(placement.get('rotation', 0)); rotation = complex(math.cos(angle), math.sin(angle))
        for element in groups[index]:
            path = parse_path(element.get('d')); assert abs(path.start-path.end) < 1e-6
            points = []
            for segment in path:
                n = max(1, math.ceil(segment.length(error=1e-8)/.18))
                points.extend(segment.point(i/n)*rotation for i in range(n))
            points.append(points[0]); expected.append(LineString([(z.real,z.imag) for z in points]))
        # Translate the whole group once using its outer contour bounds; never align holes individually.
        src_outer = max(expected, key=lambda x: Polygon(x).area)
        dst_outer = max(actual, key=lambda x: Polygon(x).area)
        dx, dy = dst_outer.bounds[0]-src_outer.bounds[0], dst_outer.bounds[1]-src_outer.bounds[1]
        from shapely.affinity import translate
        expected = [translate(x, xoff=dx, yoff=dy) for x in expected]
        def distance(a,b):
            return max(float(shapely.distance(shapely.points(np.asarray(a.coords)),b).max()), float(shapely.distance(shapely.points(np.asarray(shapely.segmentize(b,.2).coords)),a).max()))
        costs = np.array([[distance(a,b) for b in actual] for a in expected]); rows, cols = linear_sum_assignment(costs)
        worst = max(worst, float(costs[rows,cols].max())); assert (costs[rows,cols] <= .05).all()
        outer = max(actual, key=lambda x: Polygon(x).area)
        holes = [list(x.coords) for x in actual if x is not outer]
        poly = Polygon(outer, holes); assert poly.is_valid; polygons.append(poly)
    assert offset == len(entities)
assert seen == set(range(3)) and len(nest['placements']) == 1
physical = box(0,-1250,2500,0)
assert all(physical.covers(p) for p in polygons)
edge = min(physical.boundary.distance(p) for p in polygons)
spacing = min(a.distance(b) for i,a in enumerate(polygons) for b in polygons[i+1:])
overlap = sum(a.intersection(b).area for i,a in enumerate(polygons) for b in polygons[i+1:])
assert edge >= 3.999 and spacing >= 7.999 and overlap < 1e-6
print(f'CHAIR_SUBSET_OK parts=3 outer=3 inner=10 edge={edge:.6f} gap={spacing:.6f} overlap={overlap:.6f} max_deviation={worst:.6f} mm')
