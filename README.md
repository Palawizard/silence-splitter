# Silence Splitter

Application locale qui analyse l'audio d'une vidéo MP4, détecte les silences et exporte une timeline XML importable dans un logiciel de montage. La vidéo source n'est jamais modifiée.

## Stack

- Electron + React + TypeScript (electron-vite)
- ffmpeg / ffprobe (installés sur le système, disponibles dans le PATH)

## Prérequis

- Node.js 20+
- ffmpeg et ffprobe accessibles depuis le terminal

## Lancer l'application

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Documentation agent

Fichiers locaux (non versionnés) : `.cursor/docs/project.md`, `.cursor/plan.md`.

## Fixtures de test

Voir `test/fixtures/README.md` pour créer les MP4 de validation (mono, multi-pistes, VFR).
