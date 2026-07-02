#!/usr/bin/env bash
# Print PopDict download stats. Requires DOWNLOADS_FN_URL and DOWNLOADS_STATS_TOKEN
# in the environment (e.g. `source .env.local`). Pass `timeseries` for the series.
set -euo pipefail

: "${DOWNLOADS_FN_URL:?set DOWNLOADS_FN_URL}"
: "${DOWNLOADS_STATS_TOKEN:?set DOWNLOADS_STATS_TOKEN}"

query="${1:-stats}"
curl -s "${DOWNLOADS_FN_URL}?${query}" \
  -H "Authorization: Bearer ${DOWNLOADS_STATS_TOKEN}" | (command -v jq >/dev/null && jq . || cat)
