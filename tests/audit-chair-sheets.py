"""Audit the two synthetic real-chair sheet exports and their boundary switch."""
import json
import os
from pathlib import Path
import ezdxf

root = Path(os.environ.get('DEEPNEST_TEST_ROOT','/tmp/deepnest-v160-chair-synthetic'))
counts = json.loads((root/'counts.json').read_text())
expected = [sum(counts[:37]), sum(counts[37:])]
combined = list(ezdxf.readfile(root/'chair.dxf').modelspace())
offset = 0
for i, count in enumerate(expected, 1):
    sets = []
    for mode in ('off','on'):
        doc = ezdxf.readfile(root/mode/f'sheet_{i:02}.dxf')
        assert doc.dxfversion == 'AC1009' and not doc.audit().errors
        entities = list(doc.modelspace())
        boundaries = [e for e in entities if e.dxf.layer == 'SHEET_BOUNDARIES']
        parts = [e for e in entities if e.dxf.layer == 'PART_OUTLINES']
        assert len(parts) == count and len(boundaries) == (mode == 'on')
        assert len(entities) == len(parts)+len(boundaries)
        assert all(e.dxftype() == 'POLYLINE' and e.is_closed for e in entities)
        if boundaries:
            xy = [(v.dxf.location.x,v.dxf.location.y) for v in boundaries[0].vertices]
            assert set(xy) == {(0,0),(10000,0),(10000,-5000),(0,-5000)}
        geometry = [[(v.dxf.location.x,v.dxf.location.y) for v in e.vertices] for e in parts]
        reference = [[(v.dxf.location.x,v.dxf.location.y) for v in e.vertices] for e in combined[offset:offset+count]]
        assert geometry == reference
        sets.append(geometry)
    assert sets[0] == sets[1]
    offset += count
    print(f'SHEET_{i:02} parts={count} boundaries=0/1 AC1009 coordinates=1:1mm')
assert offset == 256
print('CHAIR_SHEETS_OK no-overwrite checked by electron-chair-synthetic.cjs')
