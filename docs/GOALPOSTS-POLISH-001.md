# The Standards Have Changed

Issue [#9](https://github.com/QSOLKCB/Soccerweb/issues/9), based on merged PR #10 / `b9db46ab9b42cb2c3e98d2af82c10eed0b309128`. This is a presentation pass over the existing [GOALPOSTS rules](GOALPOSTS.md).

The huge pitch, tiny footballers, ball markers and camera are preserved. **CURRENT STANDARD** remains over the actual attacking opening in all three stages, with a dark backing and a minimum 11 CSS-pixel font. Posts, crossbar, net and sign use the same interpolated authoritative geometry; nothing is cached at an obsolete position. No player, ball, physics, AI, scoring, geometry or stage-progression code changes.

The new committee panel carries numbered standards, a revision count, approval stamps, clear rules and short original announcements. A warning remains visible before the existing shift. A physical revision is counted only after the geometry actually changes, not merely when a timer says it may move. Goals stay recorded; the final ledger shows the real stage points/times. The victory reads:

> YOU HAVE SUCCESSFULLY MET EVERY STANDARD.  
> A NEW STANDARD IS NOW UNDER REVIEW.

## Cosmetic boundary

`modes/goalposts_presentation.mjs` reads snapshots and events without writing match state or consuming its RNG. Copy rotates deterministically from seed, stage and accepted event count. One current notice, no queue: ordinary announcements have a 90-tick cooldown and expire after 180 ticks; higher-priority goal/stage/finale notices can preempt lower-priority notices. Repeated renders at one tick are deduplicated. Stopped simulation clocks cannot produce further physical revisions. Post pings have a separate 12-tick cooldown. Retrying or leaving resets cosmetic state.

The live region changes only when its text changes; per-frame countdowns are outside it. The short stamp animation respects both OS reduced motion and Settings → Visual effects → Minimal motion & effects. Actual posts and warnings always remain visible. Overlays scroll within the pitch on smaller screens so keyboard/controller actions remain reachable.

Seven quiet, short procedural recipes cover warning/revision, relocation, narrowing, approval, post contact, returned attempts and final review. They use the existing audio engine and separate RNG; the music/reference DSP fixtures remain unchanged. Audio listening quality is not inferred from deterministic recipe tests.

Replay stays **v5**. The new module is in the offline inventory and cache `soccerweb-v3.1.1-1`. No dependencies or external assets are added. The separate Tournament Lab implementation is unchanged. PRs cannot deploy; Pages still requires both verification jobs on main after owner merge.

## Verification and evidence

The [evidence directory](evidence/standards-polish/) records exact sources, browser outcomes and screenshots. `native-before.json` was generated from the merged-main source above. `tests/standards.test.mjs` recomputes and compares it without normalizing version metadata: 12 normal fixtures (two grounds × three difficulties × two seeds), six complete GOALPOSTS routes, every checkpoint and independent v5 replay verification. Seed-731 winning hashes remain `c5a03750` / `fa343d42` / `f29f2fc2`.

```sh
node --test tests/*.test.mjs
python3 tests/package.py
```

The existing live browser suite plays all stages with real keyboard and virtual generic SNES Gamepad API inputs, checks held-kick advancement, overlay focus, victory, export/worker verification/playback, failure/retry, saved-profile and competition isolation, and offline Pages-subpath loading. Added checks cover the exact finale, ledger, polite notice region and narrow reduced-motion result controls.

The first CI attempt passed Chromium but Firefox parried the opening shot and timed out waiting for stage clearance. That route previously sent aim/curve/release as separate host commands. The opening shot now uses the virtual SNES device to change those controls together at input sampling against the read-only active clock; stage two retains real keyboard commands. This does not alter the simulation or assert a goal that did not happen. Failures retain a state snapshot, screenshot and exported replay before the exception is rethrown. The independent comparison captures still run when a live test fails, without changing the job's failed status.

`tests/standards_browser.py` separately captures **Canvas-only production renders** before and after at identical inputs/ticks/viewports. It does not pretend to be full-app live play. Each capture is rebuilt from legitimate input ticks, verified as a replay, and drawn through the relevant production renderer with 120 camera warmup frames. The paired camera, player coordinates, geometry and match hash must be identical. Cases cover all three stages at 1365×1000, 390×720 reduced motion, 900×900 DPR2, pixel rendering, and 1920×1080 wide/minimal effects. No injected scores, positions or stage skips. See the workflow for exact baseline extraction and browser commands.

Live screenshots are wall-clock-dependent; reports retain before/after tick samples. Paired captures have exact fixed ticks. Browser runs may differ from one another. Manual playtesting/listening, a physical USB SNES adapter, Safari/WebKit and laptop/GPU profiling remain **NOT RUN**.
