import ezdxf

for index, count in ((1, 5), (2, 3)):
    doc = ezdxf.readfile('/tmp/deepnest-sheet-%02d.dxf' % index)
    assert doc.dxfversion == 'AC1009'
    assert not doc.audit().errors
    entities = list(doc.modelspace())
    assert len(entities) == count
    assert entities[0].dxf.layer == 'SHEET_BOUNDARIES'
    assert all(e.dxftype() == 'POLYLINE' and e.is_closed for e in entities)
    assert all(e.dxf.layer.startswith('PART_') for e in entities[1:])
    if index == 2:
        points = [(round(v.dxf.location.x, 3), round(v.dxf.location.y, 3)) for v in entities[1].vertices]
        assert points == [(20, -10), (20, -260), (-80, -260), (-80, -10)]
        bounds = [(round(v.dxf.location.x, 3), round(v.dxf.location.y, 3)) for v in entities[0].vertices]
        assert bounds == [(0, 0), (800, 0), (800, -600), (0, -600)]
print('EZDXF_SHEETS_AUDIT_OK')
