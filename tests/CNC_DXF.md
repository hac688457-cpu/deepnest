# CNC DXF R12 checks

Run `node tests/cnc-dxf.test.cjs`. The test writes `/tmp/deepnest-cnc-test.dxf`, which can be inspected independently with `python3 -c "import ezdxf; d=ezdxf.readfile('/tmp/deepnest-cnc-test.dxf'); assert d.dxfversion == 'AC1009'; assert not d.audit().errors"` when ezdxf is installed.

The exporter uses the geometry retained by Deepnest after import, at 0.01 mm curve approximation (0.005 mm for arcs). An open outer contour, unsupported image or rounded SVG rectangle stops export with an error. Inspect the resulting toolpaths and dimensions in the intended CAM software before machining.

## Browser integration with a real shelf

In the Codex PyCharm Snap sandbox, `/usr/bin/google-chrome` works headlessly with an isolated temporary profile and **without** `--no-sandbox`. Do not use `/snap/bin/chromium` here. Chrome may report read-only Crashpad/dconf warnings even on success. The harness checks its exit status, timeout, and a result produced by browser JavaScript. It needs Node 24 (for built-in TypeScript stripping) and Google Chrome at that absolute path; it starts a loopback-only server and deletes its temporary profile.

```sh
node tests/browser-shelf.cjs '/home/abd/Downloads/сфера/sphere_shelf_for_deepnest_Mconstant_W1700_H1700_D250_R30_T12_v1.svg' /tmp/deepnest-real-shelf.dxf
python3 tests/check-sphere-dxf.py /tmp/deepnest-real-shelf.dxf
node tests/cnc-dxf.test.cjs
```

The SVG path is an optional local input and is never copied into the repository. The Python check requires ezdxf and is specific to the named shelf; the browser harness also accepts other absolute SVG paths. It exercises the actual browser SVG parser, `DeepNest.importsvg`/part extraction, and CNC exporter with zero-offset synthetic placements; it asserts that every cleaned geometry element is retained. A throwing stub supplies the unused native nesting simplifier. The ezdxf check audits R12 and checks the first rib's dimensions and a slot point in mm. It does not prove all geometry matches the source, run nesting, test the Electron window/export menu, or replace CAM inspection.
