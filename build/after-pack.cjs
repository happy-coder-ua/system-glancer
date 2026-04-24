const path = require('node:path');
const { chmod, rename, writeFile } = require('node:fs/promises');

async function afterPack(context) {
  if (context.electronPlatformName !== 'linux') {
    return;
  }

  const executableName = context.packager.executableName;
  const executablePath = path.join(context.appOutDir, executableName);
  const wrappedExecutablePath = path.join(context.appOutDir, `${executableName}-bin`);

  await rename(executablePath, wrappedExecutablePath);

  const wrapperScript = `#!/bin/sh
set -eu

APP_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
BIN="$APP_DIR/${executableName}-bin"

for argument in "$@"; do
  case "$argument" in
    --ozone-platform|--ozone-platform=*|--ozone-platform-hint|--ozone-platform-hint=*)
      exec "$BIN" "$@"
      ;;
  esac
done

if [ -n "\${ELECTRON_OZONE_PLATFORM_HINT:-}" ]; then
  exec "$BIN" "$@"
fi

exec "$BIN" --ozone-platform=x11 "$@"
`;

  await writeFile(executablePath, wrapperScript, 'utf8');
  await chmod(executablePath, 0o755);
  await chmod(wrappedExecutablePath, 0o755);
}

module.exports = afterPack;
module.exports.default = afterPack;