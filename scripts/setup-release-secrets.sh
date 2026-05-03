#!/usr/bin/env bash
# Interactive helper to register all 5 GitHub Secrets needed by the
# release workflow. Run from the repo root.
#
# Prereqs (you must do these manually before running this script):
#   1. ~/Desktop/balruno-developer-id.p12 exists (Keychain Access export)
#   2. You know:
#      - the .p12 password (set during export)
#      - the App-Specific Password from appleid.apple.com (the "발루노" one)
#
# Everything else is automated: base64 encode, gh secret set, cleanup, tag push.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
P12_PATH="$HOME/Desktop/balruno-developer-id.p12"
APPLE_ID_VALUE="dj258255@naver.com"
APPLE_TEAM_ID_VALUE="KR8RWBD6SY"

# ─── Pre-flight checks ──────────────────────────────────────────────────────
if [[ ! -f "$P12_PATH" ]]; then
  echo "❌ .p12 not found at $P12_PATH"
  echo ""
  echo "Export it from Keychain Access first:"
  echo "  1. Open Keychain Access"
  echo "  2. Login keychain > My Certificates"
  echo "  3. Expand 'Developer ID Application: Su Beom (KR8RWBD6SY)'"
  echo "  4. Select cert + private key (Cmd-click both)"
  echo "  5. Right-click > Export 2 items..."
  echo "  6. Save as: balruno-developer-id.p12 on Desktop"
  echo "  7. Set a password (alphanumeric only, e.g. BalrunoCert2026)"
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "❌ gh CLI not installed. brew install gh"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "❌ gh not authenticated. Run: gh auth login"
  exit 1
fi

cd "$REPO_ROOT"

# ─── Collect secrets (no echo to terminal) ─────────────────────────────────
echo "Step 1/5: enter the .p12 password (the one you set during Keychain export)"
read -r -s -p "  MAC_CERTIFICATE_PASSWORD: " CERT_PWD
echo
if [[ -z "$CERT_PWD" ]]; then
  echo "❌ password cannot be empty"
  exit 1
fi

echo ""
echo "Step 2/5: enter the App-Specific Password from appleid.apple.com"
echo "  (format: xxxx-xxxx-xxxx-xxxx — the '발루노' password)"
read -r -s -p "  APPLE_APP_SPECIFIC_PASSWORD: " APP_PWD
echo
if [[ -z "$APP_PWD" ]]; then
  echo "❌ password cannot be empty"
  exit 1
fi

# ─── Register all 5 GitHub Secrets ─────────────────────────────────────────
echo ""
echo "Step 3/5: registering 5 GitHub Secrets via gh CLI..."

# 1. base64-encoded .p12
base64 -i "$P12_PATH" | gh secret set MAC_CERTIFICATE_BASE64

# 2. .p12 password
printf '%s' "$CERT_PWD" | gh secret set MAC_CERTIFICATE_PASSWORD

# 3. Apple ID
printf '%s' "$APPLE_ID_VALUE" | gh secret set APPLE_ID

# 4. App-specific password
printf '%s' "$APP_PWD" | gh secret set APPLE_APP_SPECIFIC_PASSWORD

# 5. Team ID
printf '%s' "$APPLE_TEAM_ID_VALUE" | gh secret set APPLE_TEAM_ID

echo "  ✓ All 5 secrets registered"

# ─── Verify ────────────────────────────────────────────────────────────────
echo ""
echo "Step 4/5: verifying registered secrets"
gh secret list | grep -E "MAC_CERTIFICATE|APPLE_" || true

# ─── Cleanup .p12 (it's now in GitHub Secrets) ─────────────────────────────
echo ""
echo "Step 5/5: deleting local .p12 (no longer needed)"
rm -f "$P12_PATH"
echo "  ✓ $P12_PATH removed"

# ─── Done — print next step ────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════════════"
echo "✓ Setup complete. To trigger the first signed/notarized release:"
echo ""
echo "    git tag v0.1.0"
echo "    git push origin v0.1.0"
echo ""
echo "  Then watch: https://github.com/dj258255/balruno/actions"
echo "════════════════════════════════════════════════════════════════════"
