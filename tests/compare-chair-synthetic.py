"""Match every source group and contour to the source-mode synthetic DXF in fixed coordinates."""
import json
import math
import os
from pathlib import Path
import xml.etree.ElementTree as ET

import ezdxf
import numpy as np
import shapely
from scipy.optimize import linear_sum_assignment
from shapely.geometry import LineString
from svgpathtools import parse_path

source = Path(os.environ.get('DEEPNEST_SVG', '/home/abd/Downloads/кресло/chair_for_deepnest_T18_D11_N16_v1.svg'))
root = Path(os.environ.get('DEEPNEST_TEST_ROOT', '/tmp/deepnest-v160-chair-synthetic'))
svg = ET.parse(source).getroot()
width, height = map(float, [svg.get('width')[:-2], svg.get('height')[:-2]])
assert svg.get('width').endswith('mm') and svg.get('height').endswith('mm')
assert list(map(float, svg.get('viewBox').split())) == [0, 0, width, height]
counts = json.loads((root / 'counts.json').read_text())
doc = ezdxf.readfile(root / 'chair.dxf')
assert doc.dxfversion == 'AC1009' and not doc.audit().errors
entities = list(doc.modelspace())
assert len(svg) == len(counts) == 74 and len(entities) == sum(counts) == 256
assert all(e.dxftype() == 'POLYLINE' and e.is_closed and e.dxf.layer == 'PART_OUTLINES' for e in entities)

def distance(expected, actual):
    return max(float(shapely.distance(shapely.points(np.asarray(expected.coords)), actual).max()),
               float(shapely.distance(shapely.points(np.asarray(shapely.segmentize(actual, .2).coords)), expected).max()))

offset = 0
worst = 0
arc_count = 0
for index, (group, count) in enumerate(zip(svg, counts)):
    assert group.get('transform') == f'translate(0,{height}) scale(1,-1)'
    paths = group.findall('{http://www.w3.org/2000/svg}path')
    assert len(paths) == count
    expected = []
    for element in paths:
        path = parse_path(element.get('d'))
        assert len(path.continuous_subpaths()) == 1 and abs(path.start-path.end) < 1e-6
        points = []
        for segment in path:
            arc_count += type(segment).__name__ == 'Arc'
            # Arc length, with a conservative margin for numerical quadrature.
            n = max(1, math.ceil(segment.length(error=1e-8) / .18))
            points.extend((segment.point(i/n).real, segment.point(i/n).imag-height) for i in range(n))
        points.append(points[0])
        expected.append(LineString(points))
    actual = []
    for entity in entities[offset:offset+count]:
        xy = [(v.dxf.location.x,v.dxf.location.y) for v in entity.vertices]
        actual.append(LineString(xy + xy[:1]))
    offset += count
    # Match only within the same part; no translation or independent alignment is allowed.
    costs = np.array([[distance(a,b) for b in actual] for a in expected])
    rows, cols = linear_sum_assignment(costs)
    errors = costs[rows,cols]
    worst = max(worst, float(errors.max()))
    assert (errors <= .05).all(), f'group {index} {group.get("id")}: {errors}'
    if index == 0:
        from shapely.affinity import translate
        assert distance(expected[0], translate(actual[cols[0]], xoff=1)) > .05, 'negative control failed'
    print(f'{index:02} {group.get("id")} {count} contours max {errors.max():.6f} mm')
assert offset == 256 and arc_count > 0
print(f'CHAIR_COMPARE_OK groups=74 contours=256 arcs={arc_count} max={worst:.6f} mm threshold=0.05 mm')
