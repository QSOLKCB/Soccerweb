# SOCCERWEB 1.0.0 — release candidate

This first implementation adds a playable native-web arcade football game to the existing Apache-2.0 repository. All game code, Canvas artwork, club identities, interface and synthesized sound are original.

## Delivered

Complete outdoor and indoor match flow, CPU and local-human opponents, eight clubs, three difficulty settings, physical ball control, shot charging, passes, curve/aftertouch, lofted and aerial contact, tackles, keeper reactions, weather, automatic set pieces, halftime/full time, Cup/Challenge progression, local settings, original audiovisual presentation, slow-motion goal playback, tick-indexed replay export/import and offline caching.

The repository now includes deterministic regression tests, a real-browser CI smoke suite, static packaging, and a Pages deployment workflow that cannot publish a PR branch.

## Exact limitations and next pass

1. **Gameplay polish:** this is an engineering release candidate. Automated football actions and mode completion do not establish that the difficulty curve is enjoyable. Extended human playtesting and balance tuning remain necessary.
2. **AI depth:** positional/support heuristics, pass utility, reaction timing and keeper decisions are implemented. There is no learning, tactical editor, stamina or sophisticated coordinated off-ball strategy. Dense contacts use stable player order and merit fairness tuning.
3. **Arcade rules:** no offside, fouls, cards, substitutions or penalty shootouts. Set pieces reposition the taker and restart automatically. Knockout draws use unlimited golden goal. A rare bounded CPU-fixture failure reports a retry rather than inventing a winner.
4. **Cup elimination:** losing ends the user's cup run; the remaining all-CPU rounds are not played out into a spectator championship. Winning all three rounds completes the cup. A complete match can be replayed after a tab closes mid-fixture because progress saves between rounds, not mid-match.
5. **Devices:** desktop keyboard and standard Gamepad API layouts are supported. Physical controller/disconnection behavior, Safari/Firefox and mobile installation still need a device matrix. No touch game controls, network play or accessibility alternative to real-time Canvas gameplay are provided.
6. **Visuals:** optional CRT is a scanline overlay, not a phosphor simulator. There is no alternate low-resolution framebuffer/pixel-scaling control. Screen-reader access covers menus, controls and status, not spatial football play.
7. **Audio:** music events and reference PCM are deterministic. The complete Web Audio mix is not bit-exact across browsers, and the reference PCM does not duplicate the live synth. Human listening/balance review remains outstanding.
8. **Replays:** format v1 is tied to this simulation release. No seek/scrub editor or backward-compatible migration layer is provided. Hashes are noncryptographic. Long-running live matches are not auto-saved to browser storage.
9. **Offline/install:** cached browser play is implemented. Install UI and SVG icon support vary by browser. First use must complete asset caching online. New cache activation waits for old tabs to close.
10. **Release:** the feature branch is prepared for review. The protected/default branch has not been merged and the game has not been deployed from this PR. Review passing CI and manually play both ground types before approving a production release.

Priorities for the next pass: interactive difficulty and keeper tuning; controller/browser matrix; richer coordinated team movement; touch accessibility; replay seeking; optional integer full-mix audio export; and recorded cross-engine replay fixtures.
