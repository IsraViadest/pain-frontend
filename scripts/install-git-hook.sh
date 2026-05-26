#!/usr/bin/env bash
# Installs a local pre-commit hook (not committed into .git/hooks by git itself).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOK_DST="$ROOT/.git/hooks/pre-commit"

if [[ ! -d "$ROOT/.git" ]]; then
  echo "No .git directory. Run 'git init' first."
  exit 1
fi

cat > "$HOOK_DST" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
npm run check --prefix "$ROOT"
EOF
chmod +x "$HOOK_DST"
echo "Installed $HOOK_DST → runs: npm run check"
