# Silence Splitter

### Remove silence from MP4 recordings and continue editing in your NLE

[![Electron](https://img.shields.io/badge/Electron-43-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![CI](https://github.com/Palawizard/silence-splitter/actions/workflows/ci.yml/badge.svg)](https://github.com/Palawizard/silence-splitter/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows-0078D4?logo=windows&logoColor=white)](https://www.microsoft.com/windows)

[Features](#features) | [Download](#download) | [Quick start](#quick-start) | [Architecture](#architecture) | [Verification](#verification)

---

## Features

### Silence detection

- Automatic threshold calculated from the selected audio tracks
- Four presets for energetic gaming, relaxed gaming, podcasts, and short-form video
- Adjustable minimum silence, minimum detection, and left/right padding
- Multi-track analysis with automatic filtering of low-bitrate placeholder tracks

### Timeline preview

- Kept and removed regions displayed on a scrollable waveform
- Cut-aware 48 kHz audio playback before export
- Smooth playhead, click-to-seek, and automatic viewport navigation
- The preview and every export use the same computed segments

### Editing exports

- DaVinci Resolve: OTIO recommended, FCP7 XML compatibility fallback
- Adobe Premiere Pro: OTIO with native stereo tracks, FCP7 XML fallback
- One codec-copy sidecar per source audio stream, without re-encoding
- Original MP4 files are never modified

### Experience

- French and English interface
- System, light, and dark themes
- Local processing with no account, cloud service, or telemetry
- Automatic updates through GitHub Releases

### Known limitations (beta)

- Windows 10 and 11 only
- Unsigned installer; Windows SmartScreen may require additional confirmation
- `ffmpeg` and `ffprobe` must be installed separately and available on `PATH`
- MP4 input only
- Automatic updates require a GitHub release newer than the installed version

---

## Download

Installers are published on [GitHub Releases](https://github.com/Palawizard/silence-splitter/releases).

| File | Description |
| --- | --- |
| `Silence-Splitter-*-x64-setup.exe` | Windows NSIS installer for the current user |
| `latest.yml` | Automatic update metadata |

Before opening Silence Splitter, install [ffmpeg](https://ffmpeg.org/download.html) and verify that both commands are available:

```powershell
ffmpeg -version
ffprobe -version
```

---

## Quick start

### Prerequisites

- Windows 10 or Windows 11
- [Node.js](https://nodejs.org/) 22 or later
- [ffmpeg](https://ffmpeg.org/download.html) and ffprobe on `PATH`

### Install dependencies

```powershell
npm ci
```

### Run in development

```powershell
npm run dev
```

### Verify the project

```powershell
npm run typecheck
npm test
npm run build
```

### Build the Windows installer

```powershell
npm run dist
```

The installer and update metadata are generated in `dist/`.

---

## Useful scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run the Electron application with hot reload |
| `npm run typecheck` | Check main, preload, and renderer TypeScript |
| `npm test` | Run the stable Epic 1-7 regression suite |
| `npm run test:timebolt` | Compare detection against machine-local TimeBolt references |
| `npm run build` | Build the production Electron application |
| `npm run icons` | Generate PNG and ICO assets from the SVG source |
| `npm run fixtures` | Generate synthetic local MP4 regression fixtures |
| `npm run dist` | Build the x64 Windows NSIS installer |

---

## Architecture

```text
silence-splitter/
|-- src/
|   |-- core/                  Pure detection, segment, playback, and export logic
|   |-- main/                  Electron lifecycle, ffmpeg, IPC, settings, and updates
|   |-- preload/               Typed context bridge
|   `-- renderer/              React interface, timeline, themes, and translations
|-- scripts/                   Regression, diagnostics, and icon generation
|-- build/                     Hand-authored SVG and generated installer assets
`-- .github/workflows/         CI and tagged release automation
```

### Processing flow

```text
MP4 -> ffprobe metadata -> selected audio tracks -> silence detection
    -> keep segments -> timeline preview
                     -> Resolve or Premiere timeline + audio sidecars
```

The analysis mix is temporary. Exported timelines always reference the original video and codec-copy audio sidecars.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Desktop shell | Electron 43 and electron-vite |
| Frontend | React 19 and strict TypeScript |
| Media | System ffmpeg and ffprobe processes |
| Export | OpenTimelineIO JSON and FCP7 XML |
| Packaging | electron-builder with NSIS |
| Updates | electron-updater and GitHub Releases |
| Quality | TypeScript checks, regression scripts, GitHub Actions |

---

## Security and privacy

- All media processing runs locally.
- No account, telemetry, upload, or cloud service is used.
- Source media is read-only and never overwritten.
- Browser windows use context isolation with Node.js disabled in the renderer.

See [SECURITY.md](SECURITY.md) to report a vulnerability.

---

## Verification

```powershell
npm run typecheck
npm test
npm run build
npm run dist
```

TimeBolt reference media is intentionally machine-local. Run `npm run test:timebolt` on the development workstation when changing silence detection. Installer behavior, SmartScreen, NLE imports, and a two-version automatic update must also be verified manually before release.

---

## Contributing and releases

- Integration branch: `dev`
- Commit format: `type(scope): thing done`
- Tags matching `v*` on `main` publish a GitHub prerelease
- Release procedure: [docs/release-checklist.md](docs/release-checklist.md)
- Contribution guide: [CONTRIBUTING.md](CONTRIBUTING.md)
- Changelog: [CHANGELOG.md](CHANGELOG.md)

---

## License

Distributed under the [GNU General Public License v3.0](LICENSE).

---

Silence Splitter | Beta | Windows 10/11
