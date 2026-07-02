# Silence Splitter

Application locale qui analyse l'audio d'une vidéo MP4, détecte les silences et exporte une timeline XML importable dans un logiciel de montage. La vidéo source n'est jamais modifiée.

L'export Resolve crée aussi un dossier de pistes audio annexes, remuxées sans réencodage. Conservez ce dossier avec le XML pour préserver tous les flux audio du MP4.

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

## Vérifier un export Resolve

```bash
npm run verify:resolve -- chemin/vers/timeline.xml
```

Avec Resolve ouvert sur la timeline importée, ajoutez `--resolve` pour contrôler aussi le résultat de l'import.

## Documentation agent

Fichiers locaux (non versionnés) : `.cursor/docs/project.md`, `.cursor/plan.md`.

## Fixtures de test

Voir `test/fixtures/README.md` pour créer les MP4 de validation (mono, multi-pistes, VFR).
