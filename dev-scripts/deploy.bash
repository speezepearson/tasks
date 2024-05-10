#!/bin/bash

set -euo pipefail;

npx convex deploy --cmd "npm run build" &&
cp ./dist/assets/index-*.js "$DEPLOY_DST_DIR"/main.js &&

cd "$DEPLOY_DST_DIR"
cd "$(git rev-parse --show-toplevel)"
hugo
rsync -havz public/ "$DEPLOY_RSYNC_DST"
