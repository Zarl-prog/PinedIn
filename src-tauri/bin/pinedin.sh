#!/bin/bash
# PinedIn launcher wrapper
# Sets WebKitGTK environment variables to prevent GPU compositing crashes.
export WEBKIT_DISABLE_COMPOSITING_MODE=1
export WEBKIT_DISABLE_DMABUF_RENDERER=1
exec "$(dirname "$(readlink -f "$0")")/pinedin" "$@"
