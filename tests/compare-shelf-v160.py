"""Compare the three original SVG paths to the placed R12 contours, in mm."""
import json
import math
import re
from pathlib import Path
import xml.etree.ElementTree as ET

import ezdxf
import numpy as np
import shapely
from shapely.geometry import LineString
from svgpathtools import Arc, Line, parse_path

import os
root = Path(os.environ["DEEPNEST_TEST_ROOT"]) / "output/margin-4"
source = Path("/home/abd/Downloads/сфера")
names = ["sphere_shelf_for_deepnest_Mspherical_W1600_H1600_D220_R0_T9_v1.svg"]
paths = []
for name, count in zip(names, [14]):
    tree = ET.parse(source / name)
    svg = tree.getroot()
    viewbox = list(map(float, svg.attrib['viewBox'].split()))
    assert svg.attrib['width'].endswith('mm') and svg.attrib['height'].endswith('mm')
    assert math.isclose(float(svg.attrib['width'][:-2]), viewbox[2], abs_tol=1e-8)
    assert math.isclose(float(svg.attrib['height'][:-2]), viewbox[3], abs_tol=1e-8)
    groups = list(tree.getroot())
    assert len(groups) == count
    for group in groups:
        assert re.fullmatch(r'translate\([^()]+\)\s+scale\(1,-1\)', group.attrib['transform'])
        elements = group.findall('{http://www.w3.org/2000/svg}path')
        assert len(elements) == 1
        path = parse_path(elements[0].attrib['d'])
        assert len(path.continuous_subpaths()) == 1 and abs(path.start - path.end) < 1e-6
        paths.append(path)

data = json.loads((root / 'nest.json').read_text())
nest = next(n for n in data['nests'] if n['selected'])
worst = 0
seen = set()
files = sorted(root.glob('sheet_*.dxf'))
assert len(files) == len(nest['placements'])
for sheet_index, (file, sheet) in enumerate(zip(files, nest['placements']), 1):
    entities = list(ezdxf.readfile(file).modelspace())
    assert len(entities) == len(sheet['sheetplacements'])
    for part_index, (entity, placement) in enumerate(zip(entities, sheet['sheetplacements']), 1):
        assert entity.dxftype() == 'POLYLINE' and entity.is_closed
        assert file.name == f'sheet_{sheet_index:02d}.dxf' and entity.dxf.layer == 'PART_OUTLINES'
        index = placement['source']
        assert index not in seen and placement['filename'] == names[0]
        seen.add(index)
        angle = -math.radians(placement['rotation'])
        rotation = complex(math.cos(angle), math.sin(angle))
        # Sampling every 0.2 mm bounds the distance measurement; interpolation is independent of Deepnest.
        points = []
        for segment in paths[index]:
            assert isinstance(segment, (Arc, Line))
            length_bound = (max(segment.radius.real, segment.radius.imag) * math.radians(abs(segment.delta))
                            if isinstance(segment, Arc) else segment.length())
            n = max(1, math.ceil(length_bound / 0.2))
            points.extend(segment.point(i / n) * rotation for i in range(n))
        points.append(points[0])
        xy = np.array([(p.real, p.imag) for p in points])
        actual = np.array([(v.dxf.location.x, v.dxf.location.y) for v in entity.vertices])
        actual = np.vstack((actual, actual[0]))
        xy += actual.min(axis=0) - xy.min(axis=0)
        expected_line = LineString(xy)
        actual_line = LineString(actual)
        # Directed sampled distances in both directions include slots and dogbones.
        expected_distance = shapely.distance(shapely.points(xy), actual_line).max()
        actual_sample = shapely.segmentize(actual_line, 0.2)
        actual_distance = shapely.distance(shapely.points(np.asarray(actual_sample.coords)), expected_line).max()
        error = max(expected_distance, actual_distance)
        worst = max(worst, error)
        print(f'{file.name} source {index:02d}: {error:.6f} mm')
        if error > 0.05: print(f"MISMATCH source {index}: {error:.6f} mm")
assert seen == set(range(14))
print(f'SVG_COMPARISON 14 contours; maximum sampled deviation {worst:.6f} mm')
assert worst <= 0.05, 'SVG contours differ from DXF beyond tolerance'
