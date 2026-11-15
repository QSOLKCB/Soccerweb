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
