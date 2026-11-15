# Phase 3 baseline

Merged runtime: `c89a0aa` (PR #3). Measurement-only commit **`6387770413daf525748d48129505654aca640b03`**.

[Run 43684622969](https://github.com/QSOLKCB/Soccerweb/actions/runs/43684622969): native 61/61 PASS; Chromium full match/offline/replay PASS; six sustained-input routes and four stage-performance cases PASS. **Firefox FAIL**: the audio-resume check timed out with the context suspended. Firefox stage measurements were not reached. The workflow overall failed; this is baseline failure evidence, not a passing cross-browser claim.

Artifact `browser-evidence` **14150370433**, archive SHA-256 `39f41cb9f34551016fdeb6be3322bdfd18740c52208e4633963ebc9d353cb8e1`. The PNGs, performance and route JSON here are unedited copies of its `matchday/chromium/` files. The season report is regenerated locally from an isolated checkout of merged `c89a0aa` using the final `tests/season_report.mjs`, also used for the after report. The final reporter excludes restart-team assignment from interceptions; this measurement correction does not change scores, possession measurements or simulation hashes.

An earlier baseline attempt incorrectly required over 300 simulation ticks during a fixed wall-time input route. Goal replays deliberately suspend simulation; the assertion was corrected to account for that host behavior before this run.

- `season.json`: 96 paired 120-second fixtures, all clubs, both orientations, grounds, difficulties and eight seeds. Definitions are embedded.
- `routes.json`: six active keyboard routes, not idle-input difficulty evidence. Sparse event snapshots are observational; authoritative cumulative stats are also included.
- `performance.json`: 300 measured samples after 30 warm-up frames per case. Separate simulation, snapshot and Canvas command-submission costs; RAF cadence is a separate field. No GPU completion, physical laptop profile or allocation-rate claim.
- `outdoor-2.png`, `indoor-2.png`: actual full-size live-match screenshots after the Pro input routes.
