# Verification record

Date: 15 November 2026. This record distinguishes executed automation from unperformed manual review.

## Executed locally

`node --test tests/*.test.mjs`: **33 passed, 0 failed**.

Coverage includes fixed-step determinism, identical replay inputs, malformed replays/checksums, power/trajectory, banana curvature, chips/long passes, volleys/overhead contact, swept goals, high balls, throw-ins/corners/goal kicks, indoor rebounds, ground bounce/friction, goalkeeper catches/rebounds, physical dribbling, switching, tackles, weather, full AI match progression, clocks/halftime/golden goal, equal diagonal speed, host pause semantics, independent keyboards, two simulated gamepads, blur/disconnect handling, remapping, Cup completion, Challenge progression, corrupted saves, audio event generation/reference PCM, relative static paths, offline precache coverage and an executed service-worker cache harness.

- Replay numerical fixture: **seed 731, outdoor rain, 4,000 tick-indexed input frames, 13 checkpoints, final hash `e16bc335`**. Two independent runs agree. JSON export/import resimulation verifies every checkpoint and the final hash. The final hash is pinned as the v1 regression baseline.
- Integer audio reference: **32,000 mono signed-16-bit samples at 16 kHz; hash `789c1fd6`**. Repeated generation agrees and output is non-silent and bounded. This reference is distinct from the complete live Web Audio mix.
- `python3 tests/package.py`: passed; packaged 19 local files plus `.nojekyll`.
- `python3 -m py_compile tests/browser_smoke.py tests/package.py`: passed. Compilation alone is not a browser test.
- Module syntax checks for the browser host, renderer, input, audio and competition modules passed.

A separate 12-match, 120-active-second AI sweep covered both grounds, outdoor clear/rain, Club/Elite, seeds 1988/42. Every match reached full time. Outdoor results included wins, losses and draws; indoor scores ranged from 0–2 to 5–6. Several Elite outdoor games were 0–0, including one with no shots. This is evidence for further attacking/pressing balance work, not evidence of a tuned difficulty curve.

## Browser CI

The real Chromium suite in `tests/browser_smoke.py` uses a local HTTP server under a repository subpath. It checks:

1. Main-menu content and nonblank procedural Canvas rendering.
2. Real keyboard dribbling and a charged shot through the normal browser input loop.
3. Pause/resume with an unchanged authoritative hash while paused.
4. Completion of a live 60-active-second match and a result screen.
5. Actual replay download, file import, worker verification and playback.
6. Indoor six-a-side with independent P2 keyboard input.
7. Saved settings after reload.
8. Actual service-worker-controlled reload and match start with the browser network offline.
9. No uncaught JavaScript errors.

CI execution evidence is linked in the pull request. The first setup run failed because the moving `ubuntu-latest` image was unsupported by the pinned browser tooling; CI now pins Ubuntu 24.04. Early smoke runs revealed a premature async wait predicate and a test that tried to shoot after losing possession. The test now waits on a resolved synchronous state snapshot and performs a real dribble-shot before the defender reaches the ball. It does not inject possession, scores, player positions or match time.

**Executed Chromium result: PASS** on commit `46ff855`, [GitHub Actions run 43676536333](https://github.com/QSOLKCB/Soccerweb/actions/runs/43676536333). The live match completed with score 0–1, **4,715 recorded ticks**, and replay hash **`e528151b`**. All nine check groups above passed, including actual offline reload/play and no uncaught JS errors. The workflow packaged its static artifact successfully; the deploy job was correctly skipped for the PR. Browser input timing is captured in the replay, so a separately played browser match can have a different tick count/hash while still verifying exactly.

The latest commit's check status is visible in the PR; the run linked above is retained as concrete evidence rather than claiming an unexecuted final run. PR runs never deploy.

## Not verified here

There is no supported local interactive browser-control tool in this execution environment. Local interactive playtesting, human visual judgment, audio listening, physical gamepad testing, touch/mobile installation and cross-browser replay equivalence were not performed. The automated Chromium CI run is distinct from those manual reviews. No claim is made that this first release has commercial-quality balance or presentation.

## Reproduce

See the README for local server, native tests and Python Playwright setup. All production code is buildless; browser test packages are development-only. The GitHub workflow runs the native and browser suites before packaging, and only the default-branch deploy job can publish to Pages.
