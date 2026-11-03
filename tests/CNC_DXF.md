# CNC DXF R12 checks

Run `node tests/cnc-dxf.test.cjs`. The test writes `/tmp/deepnest-cnc-test.dxf`, which can be inspected independently with `python3 -c "import ezdxf; d=ezdxf.readfile('/tmp/deepnest-cnc-test.dxf'); assert d.dxfversion == 'AC1009'; assert not d.audit().errors"` when ezdxf is installed.

The exporter uses the geometry retained by Deepnest after import, at 0.01 mm curve approximation (0.005 mm for arcs). An open outer contour, unsupported image or rounded SVG rectangle stops export with an error. Inspect the resulting toolpaths and dimensions in the intended CAM software before machining.
