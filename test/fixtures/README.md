# Media fixtures — Epic 1

Fixtures are local MP4 files used to validate probe, track selection, VFR warnings, and later XML export. They are **not** committed to the repository (binary media).

Place files in this directory:

```
test/fixtures/
├── single-track.mp4      # One audio stream
├── multi-track.mp4       # Two or more audio streams
└── variable-fps.mp4      # VFR or avg_frame_rate ≠ r_frame_rate
```

## How to obtain or create fixtures

### single-track.mp4

Any short MP4 with a single audio track (phone recording, screen capture, etc.).

Verify:

```bash
ffprobe -v error -show_streams -select_streams a single-track.mp4
```

Expect one audio stream.

### multi-track.mp4

Merge two audio sources into one container:

```bash
ffmpeg -i video.mp4 -i commentary.wav \
  -map 0:v:0 -map 0:a:0 -map 1:a:0 \
  -c:v copy -c:a aac -shortest multi-track.mp4
```

Verify:

```bash
ffprobe -v error -show_streams -select_streams a multi-track.mp4
```

Expect two or more audio streams.

### variable-fps.mp4

Screen recordings and phone footage are often VFR. Alternatively, re-encode with variable frame timing:

```bash
ffmpeg -i source.mp4 -vsync vfr -c:v libx264 -c:a copy variable-fps.mp4
```

Verify VFR in the app: after import, the yellow warning banner should appear when `avg_frame_rate` differs from `r_frame_rate`, or when `avg_frame_rate` is `0/0`.

```bash
ffprobe -v error -show_entries stream=r_frame_rate,avg_frame_rate -select_streams v:0 variable-fps.mp4
```

## Manual test checklist (Epic 1)

Dernière exécution : **2026-07-01** — voir aussi `scripts/test-epic1.ts`.

- [x] **single-track.mp4** — duration, fps, resolution shown; one audio track, checked by default; waveform ready message
- [x] **multi-track.mp4** — all audio tracks listed and checked by default; unchecking one track re-extracts waveform
- [x] **variable-fps.mp4** — VFR logic verified (unit tests); synthetic fixture is CFR — use real VFR media for UI banner check
- [x] File path with spaces imports without error
- [x] Missing ffmpeg shows startup error banner

## Pipeline separation (Epic 2)

- **Audio track selection** affects the analysis mix only (ffmpeg `amix` of selected streams).
- **Exports** (Epic 3+) always reference the original source MP4 path — never a derived analysis file.
- **Timeline preview** is read-only and derived from the same `KeepSegment[]` as XML export.

## Notes

- Waveform extraction uses a mono mix of selected tracks at 8 kHz, decimated to at most 1500 buckets.
- Silence analysis uses the same track mix at 16 kHz mono PCM (cached per file + track selection).
- Fixture paths with spaces exercise the same code paths as user media; no special handling required beyond correct quoting in ffmpeg child processes.
