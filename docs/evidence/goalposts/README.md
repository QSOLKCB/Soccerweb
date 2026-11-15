# GOALPOSTS / USB SNES evidence

Final runtime capture: **`d89bbd65fc668c4ff6d28dff8dc9c828ad6ba45d`**. [Run 43691659786](https://github.com/QSOLKCB/Soccerweb/actions/runs/43691659786), GOALPOSTS job: Chromium and Firefox **PASS**. Artifact **14152079120**, archive SHA-256 **`a704c3878a3c76afe15b0b63eaf2b57a113a905644363bd0847edd32c7e6f010`**. Files under `chromium/` and `firefox/` are unedited captures from that artifact. The later documentation/evidence commit is verified by final-head checks linked from PR #7. This records the passing GOALPOSTS job specifically; the containing workflow was superseded by that final-head run.

The route uses keyboard input for the first two stages and a virtual generic SNES adapter, after button remapping through the real calibration UI, for the third. Both runs score three real goals for four points, show victory, export the full replay, import/verify through the worker, and play it back to its final hash. The route also runs an unattended Elite failure (failure-loop coverage, not difficulty evidence), retries, returns home, checks cup/preferences isolation and reloads GOALPOSTS offline under the repository subpath.

- Chromium 141.0.7390.37: **1,083 recorded ticks, `1af41b24`**.
- Firefox 142.0: **1,085 recorded ticks, `288c322d`**.
- The differing real-browser timing streams each verify independently; fixed native stage fixtures are separate.
- `controller-calibration.png` shows the actual live logical D-pad/buttons and virtual device readout. No physical controller was attached.
- `stage-1.png`–`stage-3.png`, `victory.png`, `failure.png` and `menu.png` are actual full-size screenshots. Stage one includes moving-frame play; the completion route deliberately uses the initial aiming window for stages two/three. Native sweeps additionally test all resize/slide intervals.

`normal-before.json` was generated from an isolated merged Phase 3 checkout `b086c70` using `tests/normal_reference.mjs`; `normal-after.json` uses the implementation. All twelve streams (48,000 input ticks, 156 checkpoints) are byte-identical after normalizing only the state version to 4. `stage-fixtures.json` contains six input-driven victories at seeds 731/42 and all difficulties; regenerate complete replay files with `node tests/goalposts_report.mjs`.

Reference music/SFX traces are in the main verification artifact, separate from its live Web Audio capture. No reference WAV is claimed as a live recording. Human listening/playtesting, physical USB SNES hardware, Safari/WebKit and laptop/GPU profiling are **NOT RUN**. See [owner instructions](../../GOALPOSTS.md) and [controller guide](../../CONTROLLERS.md).
