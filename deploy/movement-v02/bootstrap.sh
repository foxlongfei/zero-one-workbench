#!/usr/bin/env bash
set -euo pipefail
# V0.2: install the unmodified full openGym application, not a stripped-down reimplementation.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UPSTREAM="${OPENGYM_REPO:-https://github.com/DuarteSantos8/openGym.git}"
TARGET="${OPENGYM_DIR:-$ROOT/opengym-upstream}"
command -v git >/dev/null || { echo "git required" >&2; exit 1; }
command -v docker >/dev/null || { echo "Docker required" >&2; exit 1; }
docker compose version >/dev/null || { echo "Docker Compose required" >&2; exit 1; }
if [[ ! -d "$TARGET/.git" ]]; then
  git clone "$UPSTREAM" "$TARGET"
else
  echo "Existing upstream checkout: $TARGET (not changing revision automatically)"
fi
cd "$TARGET"
if [[ ! -f .env ]]; then cp .env.example .env; fi
echo "Upstream revision: $(git rev-parse HEAD)"
echo "Review .env, RP_ID and ORIGIN before exposing publicly."
docker compose pull
docker compose up -d
docker compose ps
echo "Checking local API health..."
curl --fail --show-error --retry 8 --retry-delay 3 http://localhost:"${WEB_PORT:-8080}"/api/health
echo
echo "Full upstream application: http://localhost:${WEB_PORT:-8080}"
