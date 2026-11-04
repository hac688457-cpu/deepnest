"""Compare the three original SVG paths to the placed R12 contours, in mm."""
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET

import ezdxf
import numpy as np
import shapely
from shapely.geometry import LineString
from svgpathtools import parse_path

root = Path('/tmp/deepnest-cnc-gui-acceptance/output/mixed')
source = Path('/home/abd/Downloads/сфера')
names = ['sphere_shelf_for_deepnest_Mconstant_W1700_H1700_D250_R30_T12_v1.svg',
         'sphere_shelf_for_deepnest_Mspherical_W1200_H720_D160_R0_T12_v1.svg',
         'sphere_shelf_for_deepnest_Mspherical_W1500_H900_D200_R0_T12_v1.svg']
paths = []
for name, count in zip(names, [14, 9, 9]):
    tree = ET.parse(source / name)
    groups = list(tree.getroot())
    assert len(groups) == count
    for group in groups:
        assert group.attrib['transform'].endswith('scale(1,-1)')
        elements = group.findall('{http://www.w3.org/2000/svg}path')
        assert len(elements) == 1
        paths.append(parse_path(elements[0].attrib['d']))

data = json.loads((root / 'nest.json').read_text())
nest = next(n for n in data['nests'] if n['selected'])
worst = 0
seen = set()
for file, sheet in zip(sorted(root.glob('sheet_*.dxf')), nest['placements']):
    entities = list(ezdxf.readfile(file).modelspace())
    assert len(entities) == len(sheet['sheetplacements'])
    for entity, placement in zip(entities, sheet['sheetplacements']):
        index = placement['source']
        assert index not in seen and placement['filename'] == names[0 if index < 14 else 1 if index < 23 else 2]
        seen.add(index)
        angle = -math.radians(placement['rotation'])
        rotation = complex(math.cos(angle), math.sin(angle))
        # Sampling every 0.2 mm bounds the distance measurement; interpolation is independent of Deepnest.
        points = []
        for segment in paths[index]:
            n = max(1, math.ceil(segment.length(error=1e-5) / 0.2))
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
assert seen == set(range(32))
print(f'SVG_COMPARISON 32 contours; maximum sampled deviation {worst:.6f} mm')
assert worst <= 0.05, 'SVG contours differ from DXF beyond tolerance'
