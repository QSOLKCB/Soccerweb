# Unmodified Phase 1 match baseline

These original, full-size screenshots and JSON reports come from actual automated Chromium interaction with the merged Phase 1 runtime. They have not been redrawn or edited.

- Runtime base: main merge `8518a9b` (PR #1).
- Test-only baseline commit: `9e0f571294046f54aba25aabf9baf8bb43c0911c`.
- Successful CI: https://github.com/QSOLKCB/Soccerweb/actions/runs/43680179948
- Source artifact: `browser-evidence`, ID `14148391079`.
- Viewport: 1365 × 1000 CSS pixels, DPR 1. `outdoor-match.png` and `indoor-match.png` are full-page captures with the live match visible.
- `frame-timings.json` samples 120 requestAnimationFrame intervals per ground. These are CI-browser measurements, not a laptop hardware guarantee.
- `gameplay-report.json` uses 120-active-second AI matches, seeds 1988/42 and all three difficulties on both grounds. Inputs/state are not manipulated to obtain desired outcomes.

The browser suite passed gameplay input, full-time progression, replay, independent P2, keyboard overlay access and offline checks. This is automated interaction, not a human playtest or listening review.
