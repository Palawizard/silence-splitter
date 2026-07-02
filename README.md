# Silence Splitter

Application locale qui analyse l'audio d'une vidéo MP4, détecte les silences et exporte une timeline importable dans un logiciel de montage. La vidéo source n'est jamais modifiée.

L'aperçu timeline (style Timebolt) montre les zones conservées et coupées, la forme d'onde et un curseur de lecture. La lecture audio utilise un décodage 48 kHz des pistes sélectionnées, sans rendre de nouveau fichier.

L'export vers DaVinci Resolve ou Adobe Premiere Pro permet de choisir une timeline OTIO (recommandé) ou un XML de compatibilité. Chaque export crée aussi un dossier de pistes audio annexes remuxées sans réencodage. Conservez la timeline choisie et ce dossier ensemble pour préserver tous les flux audio du MP4.

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

Fichiers locaux (non versionnés) : `.cursor/docs/project.md`, `.cursor/docs/agents.md`, `.cursor/plan.md`.

## Fixtures de test

Voir `test/fixtures/README.md` pour créer les MP4 de validation (mono, multi-pistes, VFR).
