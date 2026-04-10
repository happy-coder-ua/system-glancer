# Ubuntu Glancer

Ubuntu Glancer is an Electron desktop app inspired by Glances. It shows live CPU, memory, disk, network, process, and temperature metrics for Ubuntu machines.

## Stack

- Electron 41
- React 19 + TypeScript 6
- Vite 8
- Tailwind CSS 4
- Vitest + React Testing Library
- electron-store

## Scripts

- `npm run dev` — start the app in development mode
- `npm run build` — typecheck, build, package AppImage and deb
- `npm run build:dir` — build unpacked Linux app
- `npm run test` — run tests once

## Features

- Live CPU, memory, swap, and load averages
- Disk usage overview for root and home mounts
- Network interface summary
- Top processes by CPU usage
- Sensor temperature readings when `lm-sensors` is installed
- Stored refresh interval preference via electron-store

## Notes

- The app is optimized for Ubuntu and gracefully degrades when optional tools like `sensors` are not installed.
- Process and disk metrics are collected in the main process and exposed via IPC.
