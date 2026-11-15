# Standards polish evidence

Baseline: merged main / PR #10, `b9db46ab9b42cb2c3e98d2af82c10eed0b309128`.

- **PASS:** 143 native tests, including 12 unchanged v5 normal fixture results and six unchanged complete GOALPOSTS routes/checkpoints, announcement cooldown/event/mutation tests, sign geometry, original SFX bounds, complete host finale/retry and existing regressions.
- **PASS:** 30 local runtime files packaged; runtime imports and offline inventory checked.
- **PENDING:** real Chromium/Firefox live runs and paired screenshots; exact workflow source and artifacts will be recorded after execution.
- **NOT RUN:** human playtesting, manual listening, physical USB SNES hardware, Safari/WebKit and laptop/GPU profiling.

Initial browser attempt: [run 43702343462](https://github.com/QSOLKCB/Soccerweb/actions/runs/43702343462), feature source `dee6a6bd72095b9564067bede0800355a7f69199`, tested merge `0526efe3b4f811f2a469d0bf8c67edbd6bf595f6`. Chromium **PASS** (1,084 ticks, replay `b68eeb8a`). Firefox **FAIL** waiting for the first stage-clear overlay after the opening shot was parried; comparison steps were consequently not reached. The [original artifact](https://github.com/QSOLKCB/Soccerweb/actions/runs/43702343462/artifacts/14156613048) retains that screenshot. The subsequent test change synchronizes the opening virtual-SNES input at sampling, retains keyboard stage-two coverage and saves diagnostic state/replays on failure. Gameplay is unchanged; this attempt is not represented as a Firefox pass.

The committed `native-before.json` is the exact merged-main reference; native tests require the new source to match it without version normalization. Browser probes and full live gameplay captures are separate, labelled evidence. See [implementation and reproduction](../../GOALPOSTS-POLISH-001.md).
