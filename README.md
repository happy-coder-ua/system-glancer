# System Glancer

System Glancer is an Electron desktop app inspired by Glances. It shows live CPU, memory, mounted physical disk, network, process, and temperature metrics for Ubuntu machines.

![System Glancer](build/promo.png)

## Install from Snap Store

[![system-glancer](https://snapcraft.io/system-glancer/badge.svg)](https://snapcraft.io/system-glancer)

```bash
sudo snap install system-glancer
```

After installation, connect the required interfaces:

```bash
sudo snap connect system-glancer:hardware-observe
sudo snap connect system-glancer:mount-observe
sudo snap connect system-glancer:system-observe
sudo snap connect system-glancer:process-control
sudo snap connect system-glancer:network-observe
```

## Support

<p>
	<a href="https://ko-fi.com/happy_coder_ua">
		<img alt="Support on Ko-fi" src="https://img.shields.io/badge/Ko--fi-happy__coder__ua-FF5E5B?logo=kofi&logoColor=white">
	</a>
</p>

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
- Disk usage overview for mounted physical devices with vendor and model labels
- Network summary for physical interfaces and localhost with merged IPv4 and IPv6 addresses, subnet masks, and gateways
- Top processes by CPU usage
- Sensor temperature readings via sysfs (`/sys/class/hwmon/`) in a two-column dashboard grid
- Custom application menu with File, Edit, View, Window, Help (GitHub link + About panel)
- Stored refresh interval preference via electron-store

## Snap Notes

- The Snap package ships AppStream metadata from `snap/local/system-glancer.metainfo.xml`.
- The dashboard relies on `hardware-observe`, `mount-observe`, `system-observe`, `process-control`, and `network-observe` for full Linux telemetry.
- Network gateway and subnet details are collected from `ip -j addr show` and `ip -j route show` inside the sandbox.
- Snap launches the app through a dedicated wrapper script so Electron starts with `--ozone-platform=x11` before Chromium initializes.

## Versioning

Follows [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`). Version in `package.json` must be bumped before every commit. A `pre-commit` hook enforces this.

## Notes

- The app is optimized for Ubuntu and gracefully degrades when optional tools like `sensors` are not installed.
- Process and disk metrics are collected in the main process and exposed via IPC.
- Linux development startup uses `vite-plugin-electron` `onstart()` to inject `--ozone-platform=x11` before Electron starts.
- Linux package builds wrap the Electron binary during packaging and inject `--ozone-platform=x11` before Chromium initializes.
- Snap uses its own launcher wrapper for the same X11 fallback because the snap runtime command chain is separate from `electron-builder` packaging.
- Explicit user overrides via `--ozone-platform`, `--ozone-platform-hint`, or `ELECTRON_OZONE_PLATFORM_HINT` are still respected outside the snap launcher wrapper.

## License

Licensed under Apache-2.0.

- You may use, modify, and redistribute the project.
- You must preserve the original copyright notice, license text, and NOTICE attribution.
- Reuse without keeping the original attribution and license terms is not permitted.
