#!/bin/sh
set -eu
umask 077

backup_dir=/backups/daily
mkdir -p "$backup_dir"

while :; do
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  temporary="$backup_dir/.shmavito-$stamp.dump.tmp"
  target="$backup_dir/shmavito-$stamp.dump"

  if pg_dump --format=custom --compress=6 --no-owner --no-privileges --file="$temporary" \
    && pg_restore --list "$temporary" >/dev/null; then
    mv "$temporary" "$target"
    sha256sum "$target" > "$target.sha256"
    echo "backup_completed $target"
    find "$backup_dir" -type f -name 'shmavito-*.dump' -mtime +7 -exec rm -f -- {} \;
    find "$backup_dir" -type f -name 'shmavito-*.dump.sha256' -mtime +7 -exec rm -f -- {} \;
  else
    rm -f -- "$temporary"
    echo 'backup_failed' >&2
  fi

  sleep 86400
done
