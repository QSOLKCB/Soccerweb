# Phase 3 implementation evidence

Runtime capture commit: **`fe9e0940d8aa172be19121abd2c664417d68aa59`**. [Passing run 43686555324](https://github.com/QSOLKCB/Soccerweb/actions/runs/43686555324). Native **92/92 PASS**; Chromium and Firefox full smoke, matchday routes/practice/audio/performance **PASS**; packaging **PASS**; deployment **SKIPPED**. Later documentation/measurement-only changes are verified by the final-head run linked from PR #5.

Artifact `browser-evidence` **14150712552**, archive SHA-256 **`9dfebc116ccf832d473aa5b84a9c2aec213b0291f30ddfb3156f6047c0bb3050`**. Screenshots, browser JSON, WAVs and CPU information here are unedited copies. Unprefixed browser files are Chromium; `firefox-` files are Firefox. The full artifact also contains full-match replay exports, screenshots for every drill, deterministic reference audio and browser logs.

The local `season.json` and `summary.csv` use the final reporter against this same runtime. That reporter excludes restart-team assignment from interceptions; its scores, possession measurements and simulation hashes match the captured report. Baseline was recomputed using the same reporter against merged `c89a0aa`.

## Executed browser checks

- Chromium 141.0.7390.37 and Firefox 142.0 on Ubuntu 24.04 / Playwright 1.56. Runner reports four logical CPUs, AMD EPYC 9V74, virtualized; see `runner-cpu.txt`.
- Six sustained real-key routes across both grounds/all difficulties; simultaneous P1/P2; blur, remapping, virtual standard gamepad/disconnect. All six practice drills complete through actual controls. Keyboard and virtual-gamepad mid-charge pause/resume do not fire until a fresh action.
- Full smoke: actual outdoor full time, indoor P2, keyboard overlays, replay import/worker/playback, offline reload, high DPI/reduced motion. Chromium's timing-specific replay: 4,870 ticks, 0–2, hash `cf22abd1`. Firefox's: 6,060 ticks, 0–8, hash `00b2b377`. These idle smoke outcomes are not balance evidence.
- Fixed 4,000-input rain fixture: **v4, 13 checkpoints, `c3d201a0`** in Node and both browser engines; see `fixed-replay.json` and `firefox-fixed-replay.json`.
- `practice-ready.png` shows the actual indoor curve drill before input; `practice-3.png` shows its completed state. Outdoor/indoor Pro PNGs are full-size route captures.

## Live audio and performance boundaries

CI supplies a PulseAudio null sink. Both engines pass a plain trusted-click AudioContext preflight without autoplay-policy overrides (`audio-device.json`). The earlier baseline Firefox suspension was observed on a runner without that configured output, so it is not evidence of a universal Firefox product failure.

`live-mix.wav` and `firefox-live-mix.wav` come from the running production AudioEngine graph, MediaRecorder Opus and decoded PCM. Both have zero clipped samples; Chromium peak 0.08231/RMS 0.00723/24 peak voices, Firefox peak 0.06843/RMS 0.00519/19 peak voices. Both suspend/resume successfully. Wall-time mode changes do not guarantee equal audio-clock duration: this Chromium capture advances only about 0.012 seconds before outdoor and 0.430 before indoor, whereas Firefox records roughly 1.2 seconds per theme. Treat the Chromium recording as a short transition/mix sample, not five complete theme excerpts. Full compositions have separate deterministic reference artifacts. Neither recording has undergone human listening QA; sample-delta measurements do not establish click-free sound.

Performance JSON contains 300 measured frames per case after 30 warm-up frames. Chromium means: update 0.096–0.204 ms, snapshot 0.102–0.131 ms, draw 0.446–0.708 ms; RAF means **25.33–29.83 ms**, slower than the baseline's approximately 16.67 ms. Firefox: update 0.123–0.220 ms, snapshot 0.133–0.223 ms, draw 2.647–4.317 ms; RAF approximately 16.67 ms. Browser/VM scheduling and rasterization are not isolated by this probe. No claim of improved frame pacing or 60 FPS follows from low CPU stage times. HUD, audio, replay-history costs and GPU completion are excluded; heap snapshots do not measure allocation pressure.

**NOT RUN:** human gameplay/listening, physical controllers, Safari/WebKit and ordinary-laptop/GPU profiling. See [owner script](../../MANUAL-QA.md).
