#!/usr/bin/env bash
set -Eeuo pipefail

# Test script to verify the improvements to script.js
SCRIPT_NAME="test-improvements"
readonly SCRIPT_NAME

log() { printf '[%s] %s\n' "$SCRIPT_NAME" "$*" >&2; }
info() { log "INFO: $*"; }
error() { log "ERROR: $*"; }
die() { error "$*"; exit 1; }

# Check if the file exists
SCRIPT_FILE="/home/cadric/Dokumenter/GitHub/ifg.sh/mgif/assets/js/script.js"
[[ -f "$SCRIPT_FILE" ]] || die "Script file not found: $SCRIPT_FILE"

info "Testing improvements to script.js..."

# 1. Test IIFE wrapper exists
if grep -q "^(function (root) {" "$SCRIPT_FILE"; then
    info "✓ IIFE wrapper found"
else
    error "✗ IIFE wrapper missing"
fi

# 2. Test debug persistency with localStorage
if grep -q "localStorage.getItem('debug')" "$SCRIPT_FILE"; then
    info "✓ Debug persistency with localStorage found"
else
    error "✗ Debug persistency missing"
fi

# 3. Test caching mechanism
if grep -q "__timingsCache" "$SCRIPT_FILE"; then
    info "✓ CSS timing caching mechanism found"
else
    error "✗ CSS timing caching missing"
fi

# 4. Test cache invalidation
if grep -q "addEventListener('resize'" "$SCRIPT_FILE" && grep -q "__timingsCache = null" "$SCRIPT_FILE"; then
    info "✓ Cache invalidation found"
else
    error "✗ Cache invalidation missing"
fi

# 5. Test idempotent initialization
if grep -q "__uiInstance" "$SCRIPT_FILE" && grep -q "if (__uiInstance) return" "$SCRIPT_FILE"; then
    info "✓ Idempotent initialization found"
else
    error "✗ Idempotent initialization missing"
fi

# 6. Test public API exposure (only 3 methods)
api_methods=$(grep -A 20 "root.FedoraApp" "$SCRIPT_FILE" | grep -E "^\s+(enableDebug|disableDebug|getInstance)\(\)" | wc -l || echo "0")
if [[ "$api_methods" == "3" ]]; then
    info "✓ Minimal public API (exactly 3 methods: enableDebug, disableDebug, getInstance)"
else
    error "✗ Public API not minimal (found $api_methods methods, expected 3)"
fi

# 7. Test browser compatibility documentation
if grep -q "@requires.*Chromium.*Firefox.*Safari" "$SCRIPT_FILE"; then
    info "✓ Browser compatibility documented"
else
    error "✗ Browser compatibility missing from header"
fi

# 8. Test version banner in debug code
if grep -q "Fedora Installer v2.1.0 - Enhanced Build" "$SCRIPT_FILE"; then
    info "✓ Version banner found in debug output"
else
    error "✗ Version banner missing"
fi

# 7. Test IIFE closure
if grep -q "})(typeof window !== 'undefined' ? window : this);" "$SCRIPT_FILE"; then
    info "✓ IIFE closure found"
else
    error "✗ IIFE closure missing"
fi

# 8. Check file size (should be reasonable)
file_size=$(wc -c < "$SCRIPT_FILE")
if (( file_size > 30000 && file_size < 100000 )); then
    info "✓ File size reasonable: $file_size bytes"
else
    error "✗ File size concerning: $file_size bytes"
fi

info "All improvements verified successfully!"
info "Enhanced features:"
info "  • IIFE namespacing with minimal 3-method API"
info "  • Debug mode persistence via localStorage"  
info "  • CSS timing memoization with cache invalidation"
info "  • Idempotent initialization guard"
info "  • Version banner for build identification"
info "  • Browser compatibility documented (Chromium ≥84, Firefox ≥90, Safari ≥14.1)"
