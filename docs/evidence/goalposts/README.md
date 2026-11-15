# GOALPOSTS / USB SNES evidence

Initial browser capture: **`01a488e8b8b36ad06840fc258cad02cb38b9ff70`**. [Run 43690903464](https://github.com/QSOLKCB/Soccerweb/actions/runs/43690903464), GOALPOSTS job: Chromium and Firefox **PASS**. Artifact **14152532418**, archive SHA-256 **`f5094e644b3ea7358d4081e4fccb3bdf6685c651ceaa95c5a5809dd74cd8842f`**. Files under `chromium/` and `firefox/` are unedited captures from that artifact. Later source/final-head checks are linked from PR #7. The capture predates a small camera visibility correction and more directional warning text; final-run artifacts contain the current screens.

The route uses keyboard input for the first two stages and a virtual generic SNES adapter, after button remapping through the real calibration UI, for the third. Both runs score three real goals for four points, show victory, export the full replay, import/verify through the worker, and play it back to its final hash. The route also runs an unattended Elite failure (failure-loop coverage, not difficulty evidence), retries, returns home, checks cup/preferences isolation and reloads GOALPOSTS offline under the repository subpath.

- Chromium 141.0.7390.37: **1,083 recorded ticks, `1af41b24`**.
- Firefox 142.0: **1,083 recorded ticks, `bd9a8674`**.
- The differing real-browser timing streams each verify independently; fixed native stage fixtures are separate.
- `controller-calibration.png` shows the actual live logical D-pad/buttons and virtual device readout. No physical controller was attached.
- `stage-1.png`–`stage-3.png`, `victory.png`, `failure.png` and `menu.png` are actual full-size screenshots. Stage one includes moving-frame play; the completion route deliberately uses the initial aiming window for stages two/three. Native sweeps additionally test all resize/slide intervals.

`normal-before.json` was generated from an isolated merged Phase 3 checkout `b086c70` using `tests/normal_reference.mjs`; `normal-after.json` uses the implementation. All twelve streams (48,000 input ticks, 156 checkpoints) are byte-identical after normalizing only the state version to 4. `stage-fixtures.json` contains six input-driven victories at seeds 731/42 and all difficulties; regenerate complete replay files with `node tests/goalposts_report.mjs`.

Reference music/SFX traces are in the main verification artifact, separate from its live Web Audio capture. No reference WAV is claimed as a live recording. Human listening/playtesting, physical USB SNES hardware, Safari/WebKit and laptop/GPU profiling are **NOT RUN**. See [owner instructions](../../GOALPOSTS.md) and [controller guide](../../CONTROLLERS.md).
