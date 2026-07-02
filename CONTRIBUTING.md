# Contributing

## Development setup

Silence Splitter targets Windows 10 and 11. Install Node.js 22 or later and make sure `ffmpeg` and `ffprobe` are available on `PATH`.

```powershell
npm ci
npm run dev
```

## Verification

Run these checks before opening a pull request:

```powershell
npm run typecheck
npm test
npm run build
```

## Workflow

- Open feature work against the `dev` branch.
- Use `type(scope): thing done` commit subjects in English.
- Keep commits focused and do not include generated local editor files.
- Explain user-visible changes and manual verification in the pull request.

By contributing, you agree that your work is licensed under the GNU General Public License v3.0.
