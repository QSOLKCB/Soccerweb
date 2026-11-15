# Standards polish evidence

Baseline: merged main / PR #10, `b9db46ab9b42cb2c3e98d2af82c10eed0b309128`.

- **PASS:** 143 native tests, including 12 unchanged v5 normal fixture results and six unchanged complete GOALPOSTS routes/checkpoints, announcement cooldown/event/mutation tests, sign geometry, original SFX bounds, complete host finale/retry and existing regressions.
- **PASS:** 30 local runtime files packaged; runtime imports and offline inventory checked.
- **PENDING:** real Chromium/Firefox live runs and paired screenshots; exact workflow source and artifacts will be recorded after execution.
- **NOT RUN:** human playtesting, manual listening, physical USB SNES hardware, Safari/WebKit and laptop/GPU profiling.

The committed `native-before.json` is the exact merged-main reference; native tests require the new source to match it without version normalization. Browser probes and full live gameplay captures are separate, labelled evidence. See [implementation and reproduction](../../GOALPOSTS-POLISH-001.md).
