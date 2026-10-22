#!/usr/bin/env bash
# Copies the shared modules verbatim from the website checkout so both sides keep the same catalog and tier rules
# (SPEC §2.1). Usage: scripts/sync-from-site.sh [path-to-site-checkout]   (default: the parent directory)
# `--check` only reports drift and exits 1 when a copied file differs (use it in CI).
set -euo pipefail
cd "$(dirname "$0")/.."
check=0; [ "${1:-}" = "--check" ] && { check=1; shift; }
site="${1:-..}"
files=(
  src/config.ts src/data/seed.ts src/data/trust.ts
  src/lib/types.ts src/lib/format.ts src/lib/booking.ts src/lib/facts.ts src/lib/hubs.ts src/lib/indexing.ts
  src/lib/data.ts src/lib/dataset.ts src/lib/db-loader.ts src/lib/search.ts
  src/lib/whatsapp/bot.ts src/lib/whatsapp/client.ts src/lib/whatsapp/messages.ts src/lib/whatsapp/appointments.ts
  tests/whatsapp.test.ts
)
drift=0
for f in "${files[@]}"; do
  if [ ! -f "$site/$f" ]; then echo "missing in site: $f"; drift=1; continue; fi
  if ! cmp -s "$site/$f" "$f"; then
    drift=1
    if [ $check = 1 ]; then echo "differs: $f"; else mkdir -p "$(dirname "$f")"; cp "$site/$f" "$f"; echo "updated: $f"; fi
  fi
done
[ $check = 1 ] && [ $drift = 1 ] && exit 1
exit 0
