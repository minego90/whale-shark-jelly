#!/bin/bash
# Build: concatenates the parts into ONE self-contained HTML (dist/index.html) and stamps the visible version.
# Usage:  cd src && ./build.sh        (bump VERSION first when publishing)
set -e
cd "$(dirname "$0")"
OUT=../dist/index.html; mkdir -p ../dist
STAMP="v$(cat VERSION) - $(date -u +%m-%d_%H:%M)Z"
{ cat parts/head.html; echo '<script type="module">'; cat parts/grid.js core.js parts/jf.js parts/shaders.js parts/app.js parts/audio.js parts/phone.js; echo '</script>'; echo '</body></html>'; } > "$OUT"
# portable in-place replace (works on macOS and Linux)
perl -pi -e "s/__VER__/$STAMP/g" "$OUT"
# JS syntax check of the module code
{ cat parts/grid.js core.js parts/jf.js parts/shaders.js parts/app.js parts/audio.js parts/phone.js; } > /tmp/wsj_check.mjs
node --check /tmp/wsj_check.mjs && echo "SYNTAX_OK  ($STAMP)"
wc -c "$OUT"
# Node build of the physics (no GPU) used by tests/sim/*.js
{ cat parts/grid.js; echo "GRID = new Uint8Array(process.mainModule.require('zlib').inflateSync(Buffer.from(GRID_B64,'base64')));"; cat core.js parts/jf.js; } > core_node.js
