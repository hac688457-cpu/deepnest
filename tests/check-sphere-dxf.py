"""Check the known Mconstant W1700 sphere shelf browser export with ezdxf."""
import math
import sys

import ezdxf
from ezdxf import bbox

doc = ezdxf.readfile(sys.argv[1])
entities = list(doc.modelspace())
assert doc.dxfversion == "AC1009"
assert not doc.audit().errors
assert len(entities) == 14
assert all(e.dxftype() == "POLYLINE" and e.is_closed for e in entities)
assert len({e.dxf.layer for e in entities}) == 14
first = entities[0]
size = bbox.extents([first]).size
assert math.isclose(size.x, 827.039, abs_tol=0.01)
assert math.isclose(size.y, 250.0, abs_tol=0.01)
# First rib's slot start, including the source group translation and DXF Y flip.
assert any(math.hypot(v.dxf.location.x - 248.765387928, v.dxf.location.y + 302.353294313) < 0.01 for v in first.vertices)
print("SPHERE_DXF_EZDXF_OK: 14 closed contours, first rib 827.039 x 250 mm, slot point retained")
