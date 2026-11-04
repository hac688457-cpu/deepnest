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

## Sheet-edge margin

In Nesting configuration, **Minimum sheet-edge margin** is the minimum distance from the real part outline to the physical sheet outline. It defaults to 4 mm and is saved with settings and presets; old settings and presets use 4 mm. The field follows the displayed mm/inch units. Keep the sheet at its physical dimensions, for example 2500 × 1250 mm. Part-to-part spacing remains independent: the solver compensates for the half-spacing already included around parts, so an 8 mm spacing does not add another 4 mm to the margin.

The solver uses its existing polygon approximation and curve tolerance; inspect results in CAM before machining. A margin smaller than half the part spacing requires a rectangular sheet. A margin that eliminates or disconnects the usable sheet is rejected. Run `node tests/sheet-margin.test.cjs` after installing dependencies to exercise solver placement, rotations, unit scales and multiple sheets.

## Separate-sheet export

**CNC DXF R12 - one file per sheet** asks for a destination folder and writes `sheet_01.dxf`, `sheet_02.dxf`, and so on in nesting order, skipping sheets without placed parts. Existing files are never overwritten; choose another folder or move those files first. If a write fails, files created by that attempt are removed where possible and any cleanup failure is reported. Output is generated before writing begins.

Coordinates are in millimeters at 1:1. Each sheet uses its bounding box's upper-left corner as (0, 0), with DXF Y increasing upward, so sheet geometry normally has negative Y coordinates. There is no offset inherited from preceding sheets. The existing **export with sheet boundaries** setting controls the separate `SHEET_BOUNDARIES` layer; it is not a part machining layer. Disable that layer in CAM before generating toolpaths if boundaries are included.

## Packaged Electron acceptance on an isolated X server

Start an isolated X server before running this test; `DISPLAY` selects it and defaults to `:97`. It never uses the desktop on `:0`. The default executable is `/tmp/deepnest-acceptance-build/deepnest-v1.5.6-linux-x64/deepnest-v1.5.6`; set `DEEPNEST_APP` to another packaged executable if necessary. Set `DEEPNEST_SVG` to the representative 1200 × 720 sphere shelf SVG if it is not at the default local path. Node dependencies must already be installed. The test uses isolated HOME, XDG config/cache and nesting directories under `/tmp/deepnest-cnc-gui-acceptance`.

```
MARGIN=4 node tests/electron-cnc-acceptance.cjs
MARGIN=10 node tests/electron-cnc-acceptance.cjs
MULTI=3 MARGIN=4 node tests/electron-cnc-acceptance.cjs
python3 tests/audit-electron-cnc.py 4
python3 tests/audit-electron-cnc.py 10
python3 tests/audit-electron-cnc.py 4 multi
```

The audit requires `ezdxf` and `shapely`; a local `pip install --target /tmp/deepnest-cnc-gui-acceptance/python ezdxf shapely` and `PYTHONPATH=/tmp/deepnest-cnc-gui-acceptance/python` avoids global installation. The script imports the actual SVG, adds a 2500 × 1250 mm sheet, runs the native solver with 8 mm spacing and clicks both CNC export menu entries. `MULTI` sets the quantity of every part and sheet. It mocks open/save/message dialogs and writes screenshots, logs, nesting data and DXFs under the temporary acceptance directory, replacing its own prior outputs. The audit is specific to the default shelf: one closed outline per part, with slots on the outline, no sheet boundaries, and 90-degree rotation increments. It checks R12, audit errors, counts, bounds, intersections and clearance, but does not establish exact source-to-output contour equivalence or CAM suitability. Solver results and runtime vary; each run has a three-minute solver timeout.

## Mixed FreeCAD acceptance and source comparison

On `:97`, use `MIXED=1 MARGIN=4 timeout 260s node tests/electron-cnc-acceptance.cjs` followed by `PYTHONPATH=/tmp/deepnest-cnc-gui-acceptance/python python3 tests/audit-electron-cnc.py 4 mixed`. This selects the W1700 constant and W1200/W1500 spherical SVGs in `/home/abd/Downloads/сфера`; no input files are modified. The 32 part quantities are one each and the sheet quantity is 32. It still substitutes the dialogs. Outputs are in `/tmp/deepnest-cnc-gui-acceptance/output/mixed` and are overwritten on repeat runs.

Run `PYTHONPATH=/tmp/deepnest-cnc-gui-acceptance/python timeout 180s python3 -u tests/compare-mixed-svg.py`. Besides ezdxf and shapely it requires svgpathtools, scipy and svgwrite installed locally. It reads each original SVG path independently, samples all segments at intervals of at most 0.2 mm, applies the recorded placement rotation and aligns bounding boxes, and measures distances in both directions to the corresponding R12 contour. It verifies the file, part layer, source index and filename for each pairing. It covers the complete single contour for each of the 32 parts, including edge notches, slots and dogbone arcs; it checks shape, not absolute placement registration, and is a sampled comparison, not a formal continuous error bound. It fails if any measured deviation exceeds 0.05 mm. On the 27c4ee0 packaged build this check failed for all 32 parts (maximum sampled deviation 125.637046 mm). The SVG importer transformed arc endpoints through a reflection without reversing the sweep flag, changing the arcs before nesting and export. Chrome independently confirms the corrected sweep and angle on reflected ellipses. The arc linearizer also emitted an extra near-identical endpoint, and the exporter now drops consecutive points within 0.000001 mm to prevent microscopic self-intersections. The solver polygon consumer was updated to retain the first real arc point. These changes do not repair older DXF exports; re-import and re-nest the original SVGs. In the corrected Electron run, the maximum sampled deviation was 0.004380 mm over all 32 contours. The separate R12 sheets had 11, 12 and 9 valid closed contours, no overlap, minimum reported edge distances of 4.0000 mm and minimum spacings of 8.0000, 8.0000 and 8.0820 mm (the clearance audit allows 0.001 mm numerical tolerance). This is one sampled nesting run, not a guarantee for other layouts or a CAM/toolpath acceptance.

`timeout 240s node tests/electron-native-dialog.cjs` attempts the actual native open and save dialogs on `:97`, using an xdotool executable and library extracted under `/tmp/deepnest-cnc-gui-acceptance/xdotool-root`. It copies the SVG to an ASCII-named temporary input, never replaces application dialogs, and writes only temporary output. On the isolated environment used for this audit, the open dialog did not complete and save was consequently not reached. The native-dialog test remains unverified; it is not evidence of a successful dialog round trip.
