# Phase 3 — The Matchday Experience

Phase 3 builds on merged main `c89a0aa`, preserving the buildless runtime, fixed-step simulation and previous review guards. [Owner hands-on script](MANUAL-QA.md) · [controls](CONTROLS.md).

## Problems and focused changes

The 96-fixture baseline exposed many one/two-tick indoor possession spells. A trace of those contacts showed a keeper/attacker loop: a keeper caught a ball, an attacker immediately took it, and the keeper caught it again. Caught balls now stay protected until distribution. The spring target is near the keeper's hands instead of a forward dribbling foot; no new ball-position snap or scoring rule was added. Ordinary first touch dissipates incoming velocity, and passive steals require a defender to be at least three pixels nearer the ball than its carrier.

Input inspection found that a dedicated pass could leave a held shot armed, tackles could accumulate charge, and short keyboard taps could disappear between ticks. Explicit gesture states consume each tackle/pass/chip press; release cannot issue a second action or shoot through a new carrier. Switching cancels charge; resuming after a pause cancels it on the next recorded input tick, so keyboard/gamepad resume cannot accidentally fire. A nearby first-time kick may wait up to six ticks for physical reach. Keyboard action taps are retained for one sample; gamepad and keyboard use the same authoritative action logic. Every case has a regression assertion.

Indoor AI uses earlier keeper decisions (7/6/5 ticks at Club/Pro/Elite), keeps two defensive outlets behind possession and gives carriers a brief settling interval before passing/shooting. Speed/reach, goal geometry, drag/restitution, charge thresholds and banana-kick physics are preserved from Phase 2. Changes target observable causes of turnovers and exposed goals rather than reducing scores directly. The curve drill proves that the same wide shot can hit the post straight and score when bent.

Six optional Practice / Skills drills use authored starts with real controls, ball contacts and goals: movement, three passes, charged shot, curved goal, tackle and keeper awareness. Instructions reflect remapping. Completion pauses with retry/next controls. Practice has no match Recorder, fixture attachment or persistence writes; a host test also checks pending cup completion cannot overwrite it. Pass receipt, interception, successful tackle, gesture charge and replay scoreline have clearer feedback and quiet contextual SFX.

## Reproducible paired benchmark

`node tests/season_report.mjs`: **96 fixtures**, 120 active seconds each; outdoor/indoor × Club/Pro/Elite × eight seeds × reversed club pairing. Seeds: **42, 1988, 731, 19, 2026, 805, 99, 31415**. Each club appears in both team slots. [Before report](evidence/phase3-before/season.json) · [after report](evidence/phase3-after/season.json). Compact [before CSV](evidence/phase3-before/summary.csv) and [after CSV](evidence/phase3-after/summary.csv) are included. All fixtures reached full time.

A possession spell is consecutive active ticks with the same owning player; a stoppage ends it. Short means under 20 ticks. One/two-tick spells include deliberate kicks as well as losses, so they are not all turnovers. Interceptions mean an opposition last touch on a pass during continuous play, including deflections; assigning a restart taker is excluded. A large margin means at least five goals. These definitions differ slightly from Phase 2's rounded per-match percentages: compare this before/after pair, not percentages across different scripts.

| Indoor, 16 paired fixtures per difficulty | Club before → after | Pro before → after | Elite before → after |
| --- | --- | --- | --- |
| Short possession spells | 75.7% → 49.0% | 77.7% → 57.6% | 73.6% → 65.4% |
| One/two-tick spells | 1,897 → 59 | 1,707 → 32 | 479 → 59 |
| Goals | 202 → 103 | 207 → 101 | 81 → 71 |
| Shots | 504 → 486 | 446 → 383 | 353 → 303 |
| Mean absolute goal margin | 3.13 → 2.94 | 3.44 → 1.69 | 2.06 → 1.69 |
| Matches with margin ≥5 | 3 → 3 | 4 → 0 | 0 → 0 |

Outdoor is less uniformly improved: Pro short spells rose 41.6% → 44.4%, while Club fell 31.7% → 28.1% and Elite fell 59.4% → 57.7%. The same Pro mean goal margin rose 0.81 → 1.00. No outdoor fixture had a five-goal margin. These are fixed-seed, AI-v-AI diagnostics, not statistical proof of fun or human difficulty fairness. Club indoor still has large margins. Indoor Pro has 11 wins from the first team slot versus 4 from the second, while Elite has 3 versus 10; this sample does not establish side-neutral difficulty fairness. Both strong and weak results remain in the JSON.

## Browser, screenshots and sound

The [baseline record](evidence/phase3-before/README.md) links an unchanged Phase 2 runtime tested with the expanded scripts: Chromium passed; Firefox failed the audio-resume check. The [after record](evidence/phase3-after/README.md) records the exact implementation SHA, executed browser results and artifact provenance.

| Actual full-size match capture | Before | After |
| --- | --- | --- |
| Outdoor Pro | [PNG](evidence/phase3-before/outdoor-2.png) | [PNG](evidence/phase3-after/outdoor-2.png) |
| Indoor Pro | [PNG](evidence/phase3-before/indoor-2.png) | [PNG](evidence/phase3-after/indoor-2.png) |

`tests/matchday_browser.py` drives six sustained approach/dribble/pass/charge/chip routes through real keyboard events at both grounds/all difficulties, plus simultaneous P1/P2 movement, virtual Gamepad API inputs, blur/disconnection, remapping and actual practice completion. It never injects a score or mutable app state. The normal full-match smoke suite also verifies replay download/import/playback, overlay navigation and offline reload. An idle portion of that full-match smoke is not difficulty evidence.

`tests/live_audio_probe.mjs` captures a separate instance of the production **running AudioEngine**, through its actual Web Audio buses/compressor, into MediaRecorder Opus and decodes it to a PCM WAV. Menu/outdoor/indoor/goal/victory changes, layered effects, pause and resume are audited. `live-audio.json` reports browser, timeline, sample rate, RMS/peak/clipped samples, sample deltas and peak voices. Those are signal checks, not a human judgment about sound. Live WAVs differ by browser/timing/codec and are not bit-exact fixtures. Original deterministic reference WAVs/traces remain separately identified in `browser/audio/`; their two-second hash remains **`7787ba01`**.

CI supplies a PulseAudio null sink and verifies trusted-click audio startup in both engines without autoplay overrides. The baseline Firefox suspension occurred before that output was configured. Both live captures have zero clipped samples, but the Chromium audio clock advances unevenly during its first two wall-time excerpts; the Firefox WAV provides the longer theme sequence. See the after record for exact durations and signal measurements. Neither capture establishes click-free or pleasing sound.

Audio resumption is requested inside the user gesture and then serialized with suspension. Envelope release falls back to explicit scheduled-value cancellation on engines lacking `cancelAndHoldAtTime`. Hidden-tab event handling and the same separate audio RNGs remain in place.

## CPU stage measurements, not an FPS guarantee

`tests/performance_probe.mjs` runs actual `step`, `structuredClone` and `Renderer.draw` for 330 RAF-driven frames, discards 30 warm-up frames, and reports 300 samples per stage. Cases: outdoor wide/clear and close/rain at 1365×1000 DPR1, indoor wide DPR1, indoor close at 900×900 DPR2. The harness excludes app HUD, replay-history copies and audio work. Canvas timing is command-submission time, not GPU completion. RAF interval and long-RAF counts are separate. Chromium heap values are privacy-coarsened snapshots, not allocation-rate/GC measurements.

Baseline Chromium means were 0.124–0.239 ms update, 0.118–0.168 ms snapshot and 0.525–0.837 ms render, with four reported logical CPUs. [Before timings](evidence/phase3-before/performance.json) and [after timings](evidence/phase3-after/performance.json) include mean/p95/max, user agent, viewport and DPR. CI VMs can differ; no laptop or physical GPU profile was run. The measured baseline did not justify a renderer rewrite or new speculative optimization.

| Capture (range across four cases) | Update mean ms | Snapshot mean ms | Draw mean ms | RAF mean ms |
| --- | --- | --- | --- | --- |
| Baseline Chromium | 0.124–0.239 | 0.118–0.168 | 0.525–0.837 | ~16.67 |
| After Chromium | 0.096–0.204 | 0.102–0.131 | 0.446–0.708 | **25.33–29.83** |
| After Firefox | 0.123–0.220 | 0.133–0.223 | 2.647–4.317 | ~16.67 |

Chromium's frame pacing is worse in this capture despite similar or lower measured CPU stage costs. The probe does not isolate browser scheduling, rasterization or VM contention, so no cause or FPS improvement is claimed. Firefox has no comparable baseline performance capture because its earlier audio check stopped the suite.

## Compatibility and remaining acceptance work

Replay/simulation **v4** rejects v1/v2/v3 explicitly. Seed 731 / rain / 4,000 tick inputs / 13 checkpoints pins **`c3d201a0`**. Settings and completed between-round cup history retain their existing schema. New fixtures use the new rules. Cache/runtime version is bumped and all new modules are local/subpath-safe. PR CI cannot deploy.

**Human gameplay/listening, physical controllers, Safari/WebKit and laptop profiling: NOT RUN.** Automated practice goals do not establish the full acceptance bar. Follow the [ten-minute owner session](MANUAL-QA.md), especially indoor Club, sustained human defending, headphones and real controllers. Touch controls, online multiplayer, offside/fouls/cards/substitutions, shootouts and replay seeking remain outside scope.
