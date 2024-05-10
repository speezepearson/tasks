#!/bin/bash

set -euo pipefail;

HERE=$(git rev-parse --show-toplevel);

if ! tmux has-session -t tasks-dev 2>/dev/null; then
    tmux new-session -d -s tasks-dev         "cd $HERE && npx convex dev";
    tmux split-window  -t tasks-dev       -h "cd $HERE && npm run dev -- --port 5173";
    tmux split-window  -t tasks-dev       -v "cd $HERE && VITE_CONVEX_URL=$VITE_PROD_CONVEX_URL npm run dev -- --port 5174";
fi;
tmux attach -t tasks-dev;
