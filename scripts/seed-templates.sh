#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node --experimental-strip-types scripts/export-templates.mts > /tmp/blushcam-templates.json
( cd backend && go run ./cmd/api seed-templates /tmp/blushcam-templates.json )
