# SOCCERWEB

**New:** [GOALPOSTS arcade mode](docs/GOALPOSTS.md) · [USB SNES controller test & calibration](docs/CONTROLLERS.md).

**The beautiful game. Pure web standards.** An original QSOL–IMC arcade football game inspired by the responsiveness, banana shots, indoor walls and weather of classic overhead football.

Native HTML, CSS, JavaScript modules, Canvas 2D and Web Audio. No game engine, npm dependencies, build tool, backend, account, telemetry, external fonts or runtime network service. Apache-2.0.

## Play locally

```sh
python3 -m http.server 8000
```

Open **http://localhost:8000/**. Use an HTTP server: browsers do not reliably support module imports or service workers over `file://`.

Select your club, choose a ground and press **LET’S PLAY**, or open **Practice / Skills** for six interactive drills. The default is a two-minute outdoor match. The visible match clock stops during restarts, halftime and goal replays. A keyboard or gamepad is required; touch controls are not included.

## Controls

| Action | Player 1 | Player 2 | Gamepad |
| --- | --- | --- | --- |
| Move / aim | WASD | Arrow keys | Left stick / D-pad |
| Tap pass / hold then release shot / tackle without ball | Space | Enter | A |
| Dedicated pass / first-time pass | F | Right Shift | X |
| Chip | R | Right Ctrl | B |
| Switch player | Tab | Backslash | Y |
| Bend left / right | Q / E | [ / ] | Shoulder buttons |
| Pause / resume | Escape or P | Escape or P | Start |

The controls can be remapped independently in **Settings**. Turn before releasing a shot to aim. During flight, use left/right or curve buttons for aftertouch. To play a long lofted pass, charge the kick button and press the dedicated pass button before releasing. Meet an aerial ball for a volley; kick while moving away from the opposition goal for an overhead attempt. See [the control guide](docs/CONTROLS.md).

## Included modes and systems

- Outdoor 11-versus-11 with throw-ins, corners, goal kicks, two halves and full time.
- Indoor 6-versus-6 with a smaller pitch, faster movement and rebounding walls.
- Quick Match, independent local two-player controls and AI-versus-AI attract mode.
- Six Practice / Skills drills and the optional three-stage outdoor GOALPOSTS challenge.
- Standard and common USB SNES controller profiles, live calibration, local remapping and menu navigation.
- Eight fictional clubs with different colours and tactical tendencies; three AI difficulties.
- Eight-team knockout Cup and seven-opponent International Challenge. Ties use golden goal. Other cup fixtures run the same simulation; they are not random score generators.
- Acceleration, physical dribbling, interceptions, charging, short/long passes, straight/curved shots, chips, volleys, overhead attempts, tackles and goalkeeper saves/rebounds.
- Rain alters traction, rolling resistance and seeded slip chances.
- Articulated procedural footballers, distinct outdoor/indoor stadiums, ball shading/trails, three camera views, minimap, CRT/mint/pixel styles and reduced-motion support.
- Six original layered music themes and impact-sensitive synthesized effects, with independent volume controls.
- Automatic slow-motion goal replays and export/import of complete tick-indexed input replays.
- Local settings and competition progress; service-worker caching for offline use after the first successful load.

## Verification

The game needs no Node installation. The optional native regression suite uses Node's built-in test runner, without packages:

```sh
node --test tests/*.test.mjs
python3 tests/package.py
```

The real Chromium/Firefox smoke suite is a **development-only** Python dependency:

```sh
python3 -m venv work/test-env
work/test-env/bin/pip install playwright==1.56.0
work/test-env/bin/python -m playwright install chromium firefox
work/test-env/bin/python tests/browser_smoke.py
work/test-env/bin/python tests/goalposts_browser.py
BROWSER=firefox work/test-env/bin/python tests/goalposts_browser.py
```

Linux hosts may also need `python -m playwright install --with-deps chromium firefox`. CI uses Ubuntu 24.04. The browser suite serves the game under a repository subpath and checks real keyboard movement, shooting, pause/resume, full time, replay export/import/playback, indoor P2 input, saved settings and an offline reload/match. Screenshots, RAF timings, seeded gameplay reports, audio event traces/reference WAVs and the actual match replay are uploaded as CI artifacts. High DPI, reduced motion, display options and live audio pause/resume are also checked. The matchday suite also uses sustained human-control inputs, virtual Gamepad API devices, all practice drills, separate CPU stage measurements and captured live Web Audio. See [verification evidence and limits](docs/VERIFICATION.md).

## GitHub Pages

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) tests every PR. A push of relevant game files to `main`, or a manual run on `main`, deploys the static artifact **only after both regression and real-browser checks pass**. Feature-branch runs and pull requests cannot deploy. Pages must use **GitHub Actions** as its source (already configured for this repository).

The configured destination is `https://qsolkcb.github.io/Soccerweb/`. This is a deployment target, not a claim that this unmerged feature branch is live there. The PR must be reviewed and merged by the owner before the default-branch workflow can deploy it.

The worker precaches only local runtime assets, retains a coherent app version, and removes only this repository's old caches. New workers wait until older tabs close; reopen the game to activate an update. Bump the cache version in `sw.js` whenever runtime files change. Browser installation UI varies; cached play does not require installation.

## Engineering and release status

Read [architecture and numeric rules](docs/ARCHITECTURE.md), [release notes](docs/RELEASE-NOTES.md), and [verification](docs/VERIFICATION.md). Version 3.1 adds [GOALPOSTS](docs/GOALPOSTS.md) and [controller calibration](docs/CONTROLLERS.md), preserving the Phase 3 action/possession, training and indoor improvements. See the [Phase 3 evidence](docs/PHASE-3.md) and [owner acceptance script](docs/MANUAL-QA.md). Historical Phase 2 evidence remains available. Manual multi-browser, physical gamepad, audio listening and extended balance reviews remain part of the next engineering pass. Rules intentionally omit offside, fouls, cards, substitutions and penalty shootouts. Replay hashes detect accidental divergence, not adversarial tampering.

Historical references: [MicroProse Soccer overview](https://en.wikipedia.org/wiki/MicroProse_Soccer) and [C64 Wiki mechanics](https://www.c64-wiki.com/wiki/Microprose_Soccer). This is independent software: no original source, sprites, team data, recordings, melodies or branding are included.
