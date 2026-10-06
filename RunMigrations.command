#!/bin/bash
# Chạy lần lượt các file migration của đợt 2-5 (an toàn khi chạy lại nhiều lần).
PSQL="/Applications/Postgres.app/Contents/Versions/18/bin/psql"
DIR="$(dirname "$0")/back-end"
for f in phase2_migration.sql phase3_migration.sql phase4_migration.sql phase5_migration.sql; do
  echo "=== $f ==="
  "$PSQL" -p5432 logistics_db -f "$DIR/$f" || { echo "LỖI ở $f - dừng lại."; exit 1; }
done
echo "Xong. Hãy restart backend."
