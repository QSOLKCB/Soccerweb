# Phase 2 captured evidence

Runtime/test commit: **`8664f0c4c873502959e2c1d2d788d86ece9db4a9`**.

[Passing GitHub Actions run 43682033160](https://github.com/QSOLKCB/Soccerweb/actions/runs/43682033160), Chromium on Ubuntu 24.04. `browser-evidence` artifact **14148796383**, archive SHA-256 `1e35dc2bd5baccc9a0b66cbdb2148ef424cdf96a47be1ba93d38eddd9bfca917`. Download the artifact from that run for the full match replay, reference WAVs and musical/SFX event traces. Screenshots/JSON in this directory are copied directly from that archive, without editing or resizing.

- [Outdoor full-size match](outdoor-match.png) and [indoor full-size match](indoor-match.png): viewport 1365×1000, DPR 1. Notifications, scrolling camera and actual match state are preserved.
- [Wide view, reduced motion, DPR 2](wide-reduced-motion-dpr2.png): viewport 900×900, screenshot includes the kickoff banner at capture time.
- [Low-resolution framebuffer](low-resolution.png): same viewport, 0.65 backing ratio.
- [Frame timings](frame-timings.json): 120 RAF intervals per ground; about 16.67 ms mean, 16.7 ms p95. CI cadence only, not a laptop hardware benchmark.
- [Gameplay report](gameplay-report.json): all 12 120-second AI matches reached full time; exact scores, ticks and hashes included.
- [Audio manifest](audio-manifest.json): five seeded event hashes and integer-reference WAV sample counts/hashes. WAVs are **not** recordings of the live Web Audio mix.

The browser suite completed its outdoor match at **5,815 recorded ticks**, score **0–6**, replay hash **`d50fe9e4`**. It verifies the exact exported input stream. The test performs an opening human dribble/shot then waits for full time; this score is not a human balance measurement. Native suite: **61/61 passed**. Chromium checks, packaging and artifact upload passed; production deployment was skipped.

Later evidence/documentation-only commits can have newer PR checks without changing these captured runtime files. Refer to the PR for its exact final head and latest check. Baseline provenance is in [the before directory](../phase2-before/README.md); the [comparison](../../PHASE-2.md) explains gains, metric definitions and limitations.
