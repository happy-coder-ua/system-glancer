#!/bin/sh
set -eu

exec "$SNAP/opt/system-glancer/system-glancer" --ozone-platform=x11 --no-sandbox --disable-gpu-sandbox "$@"