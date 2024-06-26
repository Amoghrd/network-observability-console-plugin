#!/usr/bin/env bash

set -ux

echo "Starting backend..."
./plugin-backend --loglevel info --config ./config/config.yaml &
backend=$!

echo "Running tests..."
cd web
NO_COLOR=1 npm run cypress:run
cypress=$?

kill $backend
wait $backend

exit $cypress
