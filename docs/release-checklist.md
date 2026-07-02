# Release checklist

## Prepare

- [ ] Confirm the release commit is on `main` and CI is green.
- [ ] Confirm `package.json` and `CHANGELOG.md` use the intended version.
- [ ] Add `.github/release-notes/v<version>.md` with clear English release notes (Added, Known limitations, CHANGELOG link).
- [ ] Run `npm ci`, `npm run typecheck`, `npm test`, and `npm run dist` on Windows.
- [ ] Run `npm run test:timebolt` on the workstation with trusted local references.

## Manual validation

- [ ] Install the generated NSIS package for the current user.
- [ ] Confirm the app icon in the installer, Start menu, taskbar, window, and executable.
- [ ] Confirm startup works in the packaged app without a system ffmpeg install.
- [ ] Confirm the localized error still appears if bundled ffmpeg files are missing.
- [ ] Import representative OTIO and XML exports in Resolve and Premiere Pro.
- [ ] Confirm video links, every source audio stream, stereo routing, and cut boundaries.
- [ ] Install the previous release, publish the candidate, and verify download plus restart into the new version.
- [ ] Confirm SmartScreen guidance is accurate for the unsigned installer.

## Publish

- [ ] Merge the approved release commit from `dev` to `main`.
- [ ] Create and push an annotated tag matching `v<version>`.
- [ ] Confirm the Release workflow uploads the installer, blockmap, and `latest.yml`.
- [ ] Review the published release notes and confirm the release is not marked as a prerelease.
- [ ] Download the published installer and verify its SHA-256 checksum locally.

## After release

- [ ] Confirm the README download link reaches the published release.
- [ ] Open the installed app and confirm the update endpoint returns no error.
- [ ] Record any known limitations in `CHANGELOG.md` and GitHub release notes.
