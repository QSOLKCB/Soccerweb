# SOCCERWEB 2.0.0 — The Beautiful Game

Phase 2 builds on merged PR #1. Native HTML/CSS/modules, Canvas 2D, Web Audio, offline play and the fixed 60 Hz Q8 simulation remain the runtime foundation. All artwork, identities, melodies and effects are original procedural content.

## Live-match changes

- Articulated footballers with readable kits, heads, limbs, boots, keeper gloves and observed idle/run/turn/sprint/windup/kick/pass/slide/fall/dive/catch/celebration poses. Rotation, elevation, shadows and bounded trails make the ball easier to track; it draws after players.
- Textured grass, wet surfaces, goals/nets, stands, crowd reactions and lighting. Indoor has its own enclosed court, boards and glass. Follow/wide/close cameras, a scoreboard above the pitch, possession/action feedback, low-resolution pixels, high-DPI backing and reduced-motion/minimal effects.
- More responsive dry braking/turning and current-tick shot aiming; aerial contact no longer accidentally starts a ground slide. Pass selection considers lanes, leads recipients and scales pass speed. Physical dribbling, charge/curve/chip/volley controls, switching and top speeds are preserved.
- Support triangles, goal-side marking, teammate separation, deliberate pass/shot decisions and reactive keepers. Nearest eligible contact wins, with stable ID tie-breaking. Indoor rebounds lose slightly more energy. Save statistics now exclude ordinary passes.
- Five original structured 32-bar themes with rhythm/bass/lead/harmony, seeded variations, FM and shaped envelopes. Impact-sensitive SFX, separate mix buses, bounded voice scheduling and serialized pause/resume. Deterministic score/SFX traces and reference WAVs are CI artifacts.

## Compatibility and preserved review fixes

Replay **v3** explicitly rejects v1/v2 recordings: authoritative AI, response, pass/contact and indoor rules changed. The 4,000-tick seed-731 regression hash is `7f1ba5f7` (13 checkpoints). There is no backward replay migration. Settings and between-round competition saves retain their existing schema; subsequent fixtures use the new simulation.

The integer reference PCM algorithm is unchanged. Its two-second hash changes from `789c1fd6` to **`7787ba01`** because the authored score events changed. This reference is not the complete live Web Audio mix.

The prior async fixture/run-ID guard, frame-collision-before-goal precedence and keyboard-accessible pause/results overlays remain covered by regression tests. Service-worker assets/cache are updated. PR checks cannot deploy; production remains gated on verified `main` after owner merge.

## Evidence and limits

[Phase 2 comparison](PHASE-2.md) contains actual before/after match captures, seeded metrics, audio fixtures and CI provenance. [Verification](VERIFICATION.md) lists commands and coverage. All 61 native tests pass; the real Chromium workflow covers both grounds, P2, replay, offline, display options and audio state transitions.

This remains a review candidate. The 12-match seeded sweep shows less teammate crowding and more outdoor shots, but indoor brief possessions rise slightly and some indoor scorelines are lopsided. It is not proof of a balanced human difficulty curve. Human playtesting/listening, physical gamepads, Safari/Firefox, mobile installation and ordinary-laptop profiling remain unperformed here. There are no touch controls, offside/fouls/cards/substitutions/penalty shootouts, network play or replay seeking. Golden-goal and bounded CPU-fixture retry behavior remain unchanged. Screen-reader semantics cover menus/status, not spatial Canvas football.

Historical Phase 1 implementation and evidence remain in the merged PR #1 and Git history.
