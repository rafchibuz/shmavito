#!/bin/sh
set -eu

: "${CRON_SECRET:?CRON_SECRET is required}"

while :; do
  sleep 3600
  curl --fail --silent --show-error --max-time 300 \
    --request POST \
    --header "Authorization: Bearer ${CRON_SECRET}" \
    http://app:3000/api/cron/availability || true
done
