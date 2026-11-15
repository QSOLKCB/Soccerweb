# GOALPOSTS / USB SNES verification

Local native suite: **113 passed, 0 failed**. Packaging: **29 local runtime files plus `.nojekyll`**. Python compilation and whitespace checks pass. These are separate from browser execution.

- Normal football: twelve 4,000-input paired runs, both grounds × three difficulties × seeds 42/731, match merged `b086c70` at every checkpoint after normalizing only the declared version. Normal replay v5 fixture: **`541d73f5`**, 4,000 ticks / 13 checkpoints; v1–v4 rejected explicitly.
- GOALPOSTS: six genuine input-driven three-stage victories (seeds 731/42 × three difficulties), each exported and independently replay-verified. Seed-731 hashes: **`c5a03750` / `fa343d42` / `f29f2fc2`**. Tests assert goal geometry, bounds, swept crossings, frame precedence, keeper target, stopped clocks, failure/progression and isolation.
- Host stage-advance regression: holding kick through celebration records a neutral tick then a rising-edge press without reopening the stage overlay; the exported recording verifies. Already-released kick advances in one tick. Both real-browser mode routes also hold kick through celebration.
- Controller coverage: SNES and standard layouts, two-player independence, digital axes/buttons, conflicting-button swaps, validation/persistence, menu edges, held-confirm suppression and existing pause/resume/disconnect regressions.
- Audio: original six theme traces and bounded recipes; old themes/PCM pin unchanged. Browser capture includes the running GOALPOSTS theme separately from integer reference WAVs.

Final executed browser checks and exact SHA/artifact provenance are linked from [GOALPOSTS evidence](evidence/goalposts/README.md) and PR #7. The new route uses real browser keys and a virtual generic SNES adapter, completes stages, reaches victory, exports/imports/worker-verifies and plays the replay, exercises timeout/retry and offline reload. Existing Chromium/Firefox football and practice suites remain required. PR deployment is skipped; both verification jobs gate main deployment.

**NOT RUN:** a physical USB SNES controller, human gameplay/listening, Safari/WebKit and laptop/GPU profiling. The new mode has no performance-improvement claim. Follow [GOALPOSTS owner checks](GOALPOSTS.md#owner-acceptance-and-limits) and [controller calibration](CONTROLLERS.md) on the actual device.

---

# Verification record — Phase 3

## Executed locally

- `node --test tests/*.test.mjs`: **92 passed, 0 failed**. All Phase 2 regressions remain. New coverage includes tap buffering, gesture consumption, possession-change/switch cancellation, nearby first-time expiry, keeper-held protection, first-touch damping, passive steal geometry, all six drills on both grounds, real curved goal vs frame-hit/miss/save, host cup/practice isolation and portable audio envelope release.
- `node tests/season_report.mjs`: all **96 paired 120-second fixtures** reached full time. Seeds/clubs/definitions and every hash are inspectable in [Phase 3 evidence](PHASE-3.md).
- `python3 tests/package.py`: **27 local runtime files plus `.nojekyll`**.
- Python compilation and `git diff --check`: passed. Compilation is not browser execution.
- Replay v4 seed-731 rain fixture: 4,000 input frames, 13 checkpoints, **`c3d201a0`**. Earlier v1/v2/v3 files are rejected.
- Integer music PCM: 32,000 mono samples at 16 kHz, **`7787ba01`**, unchanged from Phase 2. Live graph capture is a separate artifact with browser-dependent output.

## Browser evidence and methodology

[Baseline record](evidence/phase3-before/README.md): Chromium full match and six sustained input routes passed; Firefox failed its audio-resume check. [After record](evidence/phase3-after/README.md): exact implementation SHA, final executed checks, screenshots, live audio reports and artifacts. The PR links its final-head CI separately from the capture commit.

The full smoke suite checks actual outdoor match completion, independent indoor P2, all difficulty selections, keyboard overlays, replay worker verification/playback, persistence/offline, live audio state, high DPI and reduced motion. The matchday suite adds sustained inputs at both grounds/all difficulties, simultaneous P1/P2, remapping, six practice completions, virtual standard-gamepad input/disconnection, and production live-synth recording through MediaRecorder. No production state-mutation hooks or prescribed match scores are used.

Performance probes time the actual simulation step, snapshot and Canvas command submission separately over 300 samples after warm-up, at the documented viewport/DPR/weather/camera cases. They exclude app HUD/audio/replay-history overhead and do not measure GPU completion. Coarse heap snapshots do not establish allocation pressure. See [methodology and raw reports](PHASE-3.md).

**NOT RUN:** human playtesting/listening, physical controllers, Safari/WebKit, real device background-tab behavior, and laptop/GPU profiling. Browser blur/disconnection events and virtual pads are test boundaries, not physical hardware certification. Use [MANUAL-QA.md](MANUAL-QA.md) before owner acceptance.

PR verification has read-only repository permissions and cannot deploy. Only verified main after owner merge can publish Pages.

---

## Historical Phase 2 record

# Verification record — Phase 2

Date: 15 November 2026. Automated Chromium execution and screenshot inspection are distinguished from unperformed human playtesting/listening.

## Executed checks

- `node --test tests/*.test.mjs`: **61 passed, 0 failed**. The full Phase 1 suite remains, including stale async fixture success/error guards, frame collision precedence and overlay keyboard navigation.
- `node tests/gameplay_report.mjs`: all 12 seeded 120-second AI matches reached full time. [Measured comparison](PHASE-2.md) reports improvements and regressions.
- `node tests/audio_artifacts.mjs`: five event traces, five reference WAVs, SFX recipes and a hash manifest generated successfully.
- `python3 tests/package.py`: **25 local files plus `.nojekyll`**. Runtime remains buildless and dependency-free.
- `python3 -m py_compile tests/browser_smoke.py tests/package.py` and `git diff --check`: pass. Syntax compilation alone is not browser execution.

Replay v3 numerical fixture: seed 731, outdoor rain, 4,000 tick-indexed inputs, 13 checkpoints, **`7f1ba5f7`**. Independent resimulations/export/import agree. Versions 1 and 2 are rejected explicitly. Phase 1 v2's historical pin was `7313d98c`.

Integer audio reference: 32,000 signed-16-bit mono samples at 16 kHz, **`7787ba01`**. The DSP algorithm is unchanged; the composition input changed. The reference is distinct from the live mix. Theme trace hashes and longer reference WAV hashes are recorded in [Phase 2 evidence](PHASE-2.md).

Native coverage includes deterministic simulation/replays, malformed data, all shot/pass/curve/chip/aerial mechanics, swept goals/frame collisions, set pieces, indoor rebounds, wet traction, keeper contacts, switching/tackles, clocks/halftime/golden goal, input/host pause, two keyboards/simulated gamepads, remapping/disconnect, Cup/Challenge persistence, audio and actual service-worker cache behavior. New cases measure pass delivery, lane utility, nearest-contact fairness, dry braking/wet traction, support positions, current-tick aim, keeper saves and whole-match shot creation. Render tests verify immutable snapshots/hashes, cache reuse, camera visibility, DPR/pixel sizing and pose/reduced-motion selection. Audio tests cover five distinct seeded scores, recipes, gain bounds, lifecycle and scheduler limits.

## Real Chromium CI

The workflow serves the checkout beneath a repository-style subpath and uses the actual animation/input/audio loop. It performs keyboard dribble/charge/release, all three difficulty selections, outdoor full time, independent indoor P2 movement, pause/resume with unchanged state hash, Tab/Enter/Space overlay navigation, replay download/import/worker verification/playback, persistence, actual service-worker offline reload/match and no-uncaught-error assertions. Added coverage checks actual AudioContext suspension/resumption and scheduling, wide/minimal/reduced-motion DPR 2, low-resolution backing, HUD placement and page overflow.

[Baseline run 43680179948](https://github.com/QSOLKCB/Soccerweb/actions/runs/43680179948) and [visual/gameplay pass 43681360079](https://github.com/QSOLKCB/Soccerweb/actions/runs/43681360079) passed. The [final evidence record](evidence/phase2-after/README.md) identifies the exact runtime commit, final passing run and artifacts. Latest PR checks additionally verify any later documentation/evidence commit. PR deploy jobs are skipped.

Browser input timing varies between runs: each downloaded replay captures those inputs and verifies its own final hash. The fixed numerical fixture above is a separate, stable stream. Screenshots are real full-size captures. Audio traces/WAVs identify their reference-only scope. RAF timing samples and seeded match reports are retained rather than inferring performance or balance from appearance.

## Not performed

There is no supported local interactive browser-control tool in this environment. Human outdoor/indoor playtesting, audio listening, physical gamepads, Safari/Firefox, mobile installation, cross-browser bit identity and ordinary-laptop profiling were **NOT RUN**. Automated CI gameplay and visual inspection of its screenshots do not replace those reviews. See release notes for product limitations and the indoor balance tradeoff.

Reproduction commands and development-only Playwright setup are in the README. The GitHub workflow runs native tests, measurements, Chromium and packaging; only verified `main` can deploy after owner-approved merge.
