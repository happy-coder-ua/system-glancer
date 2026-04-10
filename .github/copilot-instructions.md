# Copilot Instructions for System Glancer

## Language

- Communicate with the user in **Ukrainian** in chat responses.
- All code, comments, variable names, commit messages, and documentation must be in **English**.

## Project Overview

**System Glancer** — desktop system monitor for Ubuntu inspired by Glances.

## Tech Stack

- **Runtime:** Electron 41
- **Frontend:** React 19, TypeScript 6
- **Styling:** Tailwind CSS 4
- **Build:** Vite 8, vite-plugin-electron, electron-builder
- **Storage:** electron-store for local preferences
- **Testing:** Vitest, React Testing Library

## Conventions

- Use `@/` alias for imports from `src/`.
- Keep Electron code in `electron/`, renderer code in `src/`.
- Use IPC for all system metric access from the renderer.
- Prefer reusable dashboard components in atomic design folders.
- Use Tailwind utility classes and theme variables from `index.css`.
- Custom application menu via `Menu.buildFromTemplate()` — File, Edit, View, Window, Help (GitHub link + About panel). Do not use the default Electron menu.
- **Versioning:** Semantic Versioning (`MAJOR.MINOR.PATCH`). Bump `version` in `package.json` before every commit. A `pre-commit` hook enforces this.
