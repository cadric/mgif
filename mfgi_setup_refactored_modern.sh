#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_VERSION="18.0.0"
readonly LOG_FILE="${LOG_FILE:-/var/log/mfgi-setup.log}"
readonly LOG_MAX_SIZE="${LOG_MAX_SIZE:-10485760}"  # 10MB default
readonly LOG_KEEP_ROTATED="${LOG_KEEP_ROTATED:-3}"  # Keep 3 rotated logs
readonly NO_EMOJI="${NO_EMOJI:-0}"

# GNOME extension lists for different desktop styles
readonly WINDOWS_EXTENSIONS=(
    "dash-to-panel@jderose9.github.com"
    "arcmenu@arcmenu.com"
    "appindicatorsupport@rgcjonas.gmail.com"
)

readonly MACOS_EXTENSIONS=(
    "dash-to-dock@micxgx.gmail.com"
    "appindicatorsupport@rgcjonas.gmail.com"
)

# Global state
TEMP_DIR=""
declare -a CHANGED_ITEMS=()
declare -a SKIPPED_ITEMS=()
declare -a FAILED_ITEMS=()

# Global color variables
declare -g BOLD RESET DIM RED GREEN YELLOW BLUE MAGENTA CYAN

# Color support detection
init_colors() {
    if [[ -t 1 || -t 2 ]] && [[ -z "${NO_COLOR:-}" ]]; then
        local ncolors
        ncolors=$(tput colors 2>/dev/null || echo 0)
        if (( ncolors >= 8 )); then
            BOLD=$(tput bold)
            RESET=$(tput sgr0)
            DIM=$(tput dim 2>/dev/null || printf '')
            RED=$(tput setaf 1)
            GREEN=$(tput setaf 2)
            YELLOW=$(tput setaf 3)
            BLUE=$(tput setaf 4)
            MAGENTA=$(tput setaf 5)
            CYAN=$(tput setaf 6)
            return 0
        fi
    fi
    # No color support
    BOLD="" RESET="" DIM="" RED="" GREEN="" YELLOW="" BLUE="" MAGENTA="" CYAN=""
    return 1
}

# Error handling and cleanup
die() {
    printf '%s: %s\n' "$SCRIPT_NAME" "${1:-unknown error}" >&2
    exit "${2:-1}"
}

cleanup() {
    local exit_code=$?
    if [[ $exit_code -ne 0 ]]; then
        tput cnorm 2>/dev/null || true
        printf '%s' "${RESET:-}"
        log_error "Unexpected error occurred (exit code: $exit_code) on line ${BASH_LINENO[0]:-unknown}"
        
        # Log error to file if logging is set up
        if [[ -f "$LOG_FILE" ]]; then
            {
                printf '=== Session terminated with error at %s ===\n' "$(date '+%Y-%m-%d %H:%M:%S')"
                printf 'Exit code: %d, Line: %s\n' "$exit_code" "${BASH_LINENO[0]:-unknown}"
                printf '==========================================\n'
            } >> "$LOG_FILE" 2>/dev/null
        fi
        
        # Only print summary if we have initialized the tracking arrays
        if [[ -v CHANGED_ITEMS ]]; then
            print_summary
        fi
    fi
    [[ -n "$TEMP_DIR" ]] && rm -rf "$TEMP_DIR"
}

# Logging functions
log_debug() { [[ "${DEBUG:-0}" == "1" ]] && printf '[DEBUG] %s\n' "$*"; }
log_info()  { printf '[INFO ] %s\n' "$*"; }
log_warn()  { printf '[WARN ] %s\n' "$*" >&2; }
log_error() { printf '[ERROR] %s\n' "$*" >&2; }

# Log file rotation and size management
setup_logging() {
    local log_dir
    log_dir="$(dirname "$LOG_FILE")"
    
    # Security: refuse symlink logfiles and create with restrictive perms
    if [[ -L "$LOG_FILE" ]]; then
        die "Refusing to write to symlinked log file: $LOG_FILE"
    fi
    
    # Create log directory if it doesn't exist
    if [[ ! -d "$log_dir" ]]; then
        mkdir -p "$log_dir" 2>/dev/null || return 1
    fi
    
    # Create logfile securely if missing
    [[ -f "$LOG_FILE" ]] || ( umask 077 && : >"$LOG_FILE" ) || return 1
    
    # Check if log file exists and needs rotation
    if [[ -f "$LOG_FILE" ]]; then
        # Use file locking to prevent race conditions during rotation
        local lock_file="${LOG_FILE}.lock"
        if (
            # Try to acquire exclusive lock with timeout
            exec 200>"$lock_file"
            if flock -n 200 2>/dev/null; then
                local log_size
                log_size=$(stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)
                
                # Rotate if log file exceeds maximum size
                if (( log_size > LOG_MAX_SIZE )); then
                    rotate_log_files
                fi
            fi
        ); then
            # Lock acquired and released successfully
            rm -f "$lock_file" 2>/dev/null || true
        fi
    fi
    
    # Initialize log file with session header
    {
        printf '\n'
        printf '=== %s v%s - Session started at %s ===\n' \
            "$SCRIPT_NAME" "$SCRIPT_VERSION" "$(date '+%Y-%m-%d %H:%M:%S')"
        printf 'PID: %d, User: %s, Args: %s\n' \
            $$ "${USER:-unknown}" "${*:-none}"
        printf '=================================\n'
    } >> "$LOG_FILE" 2>/dev/null || return 1
    
    return 0
}

# Rotate log files when they get too large
rotate_log_files() {
    [[ -f "$LOG_FILE" ]] || return 0
    
    # Use atomic operations to prevent corruption during rotation
    local temp_log="${LOG_FILE}.tmp.$$"
    local lock_file="${LOG_FILE}.rotate.lock"
    
    # Acquire exclusive lock for rotation
    exec 201>"$lock_file"
    if ! flock -n 201 2>/dev/null; then
        # Another process is already rotating, skip
        exec 201>&-
        return 0
    fi
    
    # Double-check file still exists and needs rotation
    if [[ ! -f "$LOG_FILE" ]]; then
        flock -u 201 2>/dev/null || true
        exec 201>&-
        rm -f "$lock_file" 2>/dev/null || true
        return 0
    fi
    
    local current_size
    current_size=$(stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)
    if (( current_size <= LOG_MAX_SIZE )); then
        # File no longer needs rotation
        flock -u 201 2>/dev/null || true
        exec 201>&-
        rm -f "$lock_file" 2>/dev/null || true
        return 0
    fi
    
    # Perform atomic rotation
    local i
    # Move existing rotated logs (keep only LOG_KEEP_ROTATED files)
    for (( i = LOG_KEEP_ROTATED; i > 1; i-- )); do
        local old_log="${LOG_FILE}.$((i-1))"
        local new_log="${LOG_FILE}.${i}"
        [[ -f "$old_log" ]] && mv "$old_log" "$new_log" 2>/dev/null || true
    done
    
    # Create new empty log atomically
    touch "$temp_log" 2>/dev/null || {
        flock -u 201 2>/dev/null || true
        exec 201>&-
        rm -f "$lock_file" 2>/dev/null || true
        return 1
    }
    chmod 644 "$temp_log" 2>/dev/null || true
    
    # Move current log to .1 and replace with new empty log
    if mv "$LOG_FILE" "${LOG_FILE}.1" 2>/dev/null && mv "$temp_log" "$LOG_FILE" 2>/dev/null; then
        log_info "Log file rotated (previous logs kept: ${LOG_KEEP_ROTATED})"
    else
        # Restore on failure
        [[ -f "${LOG_FILE}.1" ]] && mv "${LOG_FILE}.1" "$LOG_FILE" 2>/dev/null || true
        rm -f "$temp_log" 2>/dev/null || true
    fi
    
    # Release lock and cleanup
    flock -u 201 2>/dev/null || true
    exec 201>&-
    rm -f "$lock_file" 2>/dev/null || true
}

# Emoji helper function
emoji() { [[ "$NO_EMOJI" = 1 ]] && printf '' || printf '%s' "$1"; }

# UI helper functions
headline()     { printf '%s%s%s\n'    "${BOLD}${CYAN}" "$*" "$RESET" >&2; }
subhead()      { printf '%s%s%s\n'    "$GREEN"    "$*" "$RESET" >&2; }
emph()         { printf '%s%s%s\n'    "$MAGENTA"  "*" "$RESET" >&2; }
muted()        { local content; if [[ -p /dev/stdin ]]; then content=$(cat); else content="$*"; fi; printf '%s%s%s\n'    "$DIM"      "$content" "$RESET" >&2; }
warning()      { local content; if [[ -p /dev/stdin ]]; then content=$(cat); else content="$*"; fi; printf '%s%s%s\n'    "${BOLD}${RED}" "$content" "$RESET" >&2; }
hint()         { printf '%s%s%s\n'    "$YELLOW"   "$*" "$RESET" >&2; }
prompt_line()  { printf '%s%s%s' "${BOLD}${YELLOW}" "$*" "$RESET" >&2; }
status_ok()    { printf '%s%s %s%s\n' "$GREEN" "$(emoji "✅")" "$*" "$RESET" >&2; }
status_warn()  { printf '%s%s %s%s\n' "$YELLOW" "$(emoji "⚠️")" "$*" "$RESET" >&2; }
status_fail()  { printf '%s%s %s%s\n' "$RED" "$(emoji "❌")" "$*" "$RESET" >&2; }
status_skip()  { printf '%s%s %s%s\n' "$CYAN" "$(emoji "⏭️")" "$*" "$RESET" >&2; }

usage() {
    cat <<EOF
Usage: $SCRIPT_NAME [OPTIONS]

A minimal Fedora GNOME installer with interactive setup.

Options:
  -n, --dry-run                 Simulate installation without making changes
  -s, --scope SCOPE             Flatpak scope: 'system' or 'user' (default: user)
  -a, --install-apps BOOL       Install curated apps: 'yes' or 'no' (default: no)
  -w, --install-wallpapers BOOL Install wallpapers: 'yes' or 'no' (default: no)
  -t, --style STYLE             Extension style: 1-3 (default: 1)
  -g, --hide-grub BOOL          Hide GRUB menu: 'yes' or 'no' (default: no)
  -v, --version                 Show version information
  -h, --help                    Show this help message

Environment Variables:
  MFGI_FORCE_SCOPE     Override flatpak scope (system|user)
  MFGI_INSTALL_APPS    Override app installation (yes|no)
  MFGI_SKIP_GRUB       Override GRUB configuration (yes|no)
  MFGI_STYLE           Override extension style (1-3)
  MFGI_INSTALL_WALLPAPERS Override wallpaper installation (yes|no)
  MFGI_FLATHUB_SUBSET  Use verified subset of Flathub (verified|full)
  LOG_FILE             Log file location (default: /var/log/mfgi-setup.log)
  LOG_MAX_SIZE         Max log size before rotation (default: 10MB)
  LOG_KEEP_ROTATED     Number of rotated logs to keep (default: 3)
  DEBUG                Enable debug logging (0|1)
  NO_COLOR             Disable colored output
  NO_EMOJI             Disable emoji output (0|1)

$(printf '\nDefaults: scope=%s, apps=%s, wallpapers=%s, style=%s, hide-grub=%s\n' \
  "${MFGI_FORCE_SCOPE:-user}" "${MFGI_INSTALL_APPS:-no}" \
  "${MFGI_INSTALL_WALLPAPERS:-no}" "${MFGI_STYLE:-1}" "${MFGI_SKIP_GRUB:-no}")

Examples:
  # Interactive mode (default)
  sudo "./$SCRIPT_NAME"

  # Non-interactive with options
  sudo "./$SCRIPT_NAME" --scope system --install-apps yes --style 2

  # Dry run to see what would happen
  sudo "./$SCRIPT_NAME" --dry-run

EOF
}

# Dependency checking
check_dependencies() {
    local deps=("dnf" "systemctl" "tput")
    # run_as_user/spin_as_user needs su, sudo or runuser
    local optional_deps=("dbus-run-session")
    [[ "${DRY_RUN:-0}" = "1" ]] || deps+=("curl")
    local missing=()
    local missing_optional=()
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" >/dev/null 2>&1; then
            missing+=("$dep")
        fi
    done
    
    for dep in "${optional_deps[@]}"; do
        if ! command -v "$dep" >/dev/null 2>&1; then
            missing_optional+=("$dep")
        fi
    done
    
    if [[ ${#missing[@]} -gt 0 ]]; then
        die "Missing required dependencies: ${missing[*]}"
    fi
    
    # Install optional dependencies if missing and not in dry-run mode
    if [[ ${#missing_optional[@]} -gt 0 ]] && [[ "${DRY_RUN:-0}" != "1" ]]; then
        log_info "Installing missing optional dependencies: ${missing_optional[*]}"
        if ! dnf -y install "${missing_optional[@]}"; then
            warning "Could not install optional dependencies: ${missing_optional[*]}"
            warning "Some features may not work correctly"
        fi
    fi
}

# System validation
validate_system() {
    if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
        die "This script must run as root. Use 'sudo $0'"
    fi
    
    if [[ ! -r /etc/os-release ]]; then
        die "Cannot read /etc/os-release"
    fi
    
    # shellcheck source=/dev/null
    source /etc/os-release
    if [[ "${ID:-}" != "fedora" ]]; then
        die "This script is designed for Fedora. Detected: ${NAME:-unknown}"
    fi
    
    log_info "Detected Fedora ${VERSION_ID:-unknown}"
}

# Network connectivity check
check_network() {
    if command -v nm-online >/dev/null 2>&1; then
        nm-online -q -t 15 && return 0
    fi
    
    if getent ahosts extensions.gnome.org >/dev/null 2>&1; then
        return 0
    fi
    
    if command -v ping >/dev/null 2>&1; then
        ping -c1 -W3 1.1.1.1 >/dev/null 2>&1 && return 0
    fi
    
    return 1
}

# =========================================================================
# == ROBUST USER & SESSION HANDLING (START)
# =========================================================================
# Purpose: Solves problems with running per-user commands (especially Flatpak/D-Bus)
# from a root context, e.g. after `sudo su -` or via `curl | sudo bash`.
#
# Strategy:
# 1. A robust `detect_user` finds the right desktop user.
# 2. A specialized `run_as_user_dbus` finds and reuses the user's
#    active D-Bus session, if it exists.
# 3. If no active session exists, a new, private D-Bus bus is created
#    on-the-fly with `dbus-run-session`.
# 4. A simple `run_as_user` is kept for commands that don't require D-Bus.

# Global state for user detection
DETECTED_USER=""
DETECTED_UID=""

# Check if command exists
have() { command -v "$1" >/dev/null 2>&1; }

# User detection (The smart detective)
# Finds the most likely desktop user, even in complex sudo/su scenarios.
# Source: This function is a synthesis of standard practices. It uses `loginctl`
# as the most reliable method on systemd systems, as described in
# systemd documentation for session management.
detect_user() {
    # Reset if function is called multiple times
    DETECTED_USER=""
    DETECTED_UID=""
    local u=""

    # Only run detection logic if we are root. Otherwise the user is just ourselves.
    if [[ ${EUID:-$(id -u)} -eq 0 ]]; then
        # Cascade of checks, from most to least reliable
        if [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
            u="${SUDO_USER}"
        elif have loginctl; then
            # Find the first graphical or active user session that isn't a display manager.
            # This is the most robust method on a modern desktop system.
            u=$(loginctl list-sessions --no-legend 2>/dev/null | \
                awk '$3!="gdm" && $3!="sddm" && $3!="lightdm" && $4!="" {print $3; exit}')
        fi
        # Last resort: Find the first "human" user (UID >= 1000)
        [[ -z "$u" ]] && u=$(awk -F: '$3>=1000 && $1!="nobody"{print $1; exit}' /etc/passwd 2>/dev/null || true)
    else
        u="${USER:-$(id -un)}"
    fi

    if [[ -z "$u" ]]; then
        log_warn "Could not determine a unique desktop user."
        return 1
    fi

    local uid
    uid=$(id -u "$u" 2>/dev/null)
    if [[ -z "$uid" ]]; then
        log_warn "Could not find UID for detected user: $u"
        return 1
    fi

    DETECTED_USER="$u"
    DETECTED_UID="$uid"
    log_info "Desktop user detected: ${BOLD}${DETECTED_USER}${RESET} (uid: ${DETECTED_UID})"
    return 0
}

# D-Bus sensitive command execution
# Private helper function. Contains the advanced D-Bus logic.
# Source: This method is based on Freedesktop.org's specifications for D-Bus
# and XDG Base Directory Specification. It checks for the canonical socket path
# in /run/user/$UID/bus to reuse an existing session.
_run_with_user_bus() {
    # Check if an active D-Bus session socket exists for the user.
    # '-S' checks if the file exists and is a socket.
    local bus_sock="/run/user/${DETECTED_UID}/bus"
    if [[ -S "$bus_sock" ]]; then
        # Great! We reuse the right, active desktop session.
        # We set the necessary environment variables to "connect to it".
        log_info "Reusing active D-Bus session for ${DETECTED_USER}"
        sudo -u "${DETECTED_USER}" -H -- env \
            XDG_RUNTIME_DIR="/run/user/${DETECTED_UID}" \
            DBUS_SESSION_BUS_ADDRESS="unix:path=${bus_sock}" \
            "$@"
    elif have dbus-run-session; then
        # No active session found. Plan B: We create our own private bus.
        # It's isolated, but it works for most commands.
        log_info "No active D-Bus session found. Creating a private bus with dbus-run-session."
        sudo -u "${DETECTED_USER}" -H -- dbus-run-session -- "$@"
    else
        # Last resort: Neither an active session nor the tool to make a new one.
        # We try anyway, but warn that it might fail.
        log_warn "No user-bus and 'dbus-run-session' missing. Attempting without bus (may fail)."
        sudo -u "${DETECTED_USER}" -H -- "$@"
    fi
}

# Simple `run_as_user`. Used for commands that do NOT require D-Bus (e.g. `ls`, `mkdir`).
run_as_user() {
    if [[ ${EUID:-$(id -u)} -eq 0 && -n "${DETECTED_USER}" ]]; then
        sudo -u "${DETECTED_USER}" -H -- "$@"
    else
        # Either we're not root, or we couldn't find a user. Run as ourselves.
        "$@"
    fi
}

# The advanced `run_as_user_dbus`. Used for everything that smells of D-Bus:
# flatpak --user, gsettings, gnome-extensions, dconf.
run_as_user_dbus() {
    if [[ -z "${DETECTED_USER}" ]]; then
        log_warn "Cannot run D-Bus command without a detected user."
        return 1
    fi
    if [[ ${EUID:-$(id -u)} -eq 0 ]]; then
        _run_with_user_bus "$@"
    else
        # We're already the right user, so we just run the command directly.
        # Our own D-Bus session is already active.
        "$@"
    fi
}

# Proactive check (User friendliness)
# Warns early if we anticipate D-Bus problems for user-scope.
check_user_bus_readiness() {
    # The check is only relevant if we are root.
    [[ ${EUID:-$(id -u)} -ne 0 ]] && return 0
    # If we couldn't find a user, there's no point in checking the bus.
    [[ -z "${DETECTED_UID}" ]] && return 0

    local sock="/run/user/${DETECTED_UID}/bus"
    if [[ ! -S "$sock" && ! $(have dbus-run-session) ]]; then
        log_warn "No active D-Bus session found for ${DETECTED_USER}, and 'dbus-run-session' missing."
        log_warn "Actions in 'user' scope (Flatpak, gsettings) may fail."
        log_warn "This often happens if the user is not logged into a graphical session."
    fi
}

# Updated Flatpak functions
# These functions now use the correct D-Bus-aware helper.

ensure_flathub(){
    local scope="$1"
    local args=(remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo)
    if [[ "$scope" == "user" ]]; then
        # USING THE NEW D-BUS-AWARE FUNCTION
        run_as_user_dbus flatpak --user "${args[@]}"
    else
        flatpak --system "${args[@]}"
    fi
}

install_flatpaks(){
    local scope="$1"; shift; local ids=("$@"); (( ${#ids[@]} )) || return 0
    
    for app in "${ids[@]}"; do
        # Check if already installed
        local check_args=()
        local install_args=(install -y --noninteractive flathub "$app" --or-update)
        
        if [[ "$scope" == "user" ]]; then
            check_args=(--user)
            install_args=(--user "${install_args[@]}")
            
            # Check if already installed
            if run_as_user_dbus flatpak info "${check_args[@]}" "$app" >/dev/null 2>&1; then
                track_result "skipped" "Flatpak: already installed $app"
                continue
            fi
            
            muted "Installing $app..."
            if run_as_user_dbus flatpak "${install_args[@]}"; then
                track_result "changed" "Flatpak: installed/updated $app"
            else
                # Re-check existence to provide accurate status
                if run_as_user_dbus flatpak info "${check_args[@]}" "$app" >/dev/null 2>&1; then
                    track_result "skipped" "Flatpak: present after failed attempt on $app"
                else
                    track_result "failed" "Flatpak: could not install $app"
                fi
            fi
        else
            check_args=(--system)
            install_args=(--system "${install_args[@]}")
            
            # Check if already installed
            if flatpak info "${check_args[@]}" "$app" >/dev/null 2>&1; then
                track_result "skipped" "Flatpak: already installed $app"
                continue
            fi
            
            muted "Installing $app..."
            if flatpak "${install_args[@]}"; then
                track_result "changed" "Flatpak: installed/updated $app"
            else
                # Re-check existence to provide accurate status
                if flatpak info "${check_args[@]}" "$app" >/dev/null 2>&1; then
                    track_result "skipped" "Flatpak: present after failed attempt on $app"
                else
                    track_result "failed" "Flatpak: could not install $app"
                fi
            fi
        fi
    done
}

# =========================================================================
# == ROBUST USER & SESSION HANDLING (END)
# =========================================================================

# Spinner for long-running commands
run_with_spinner() {
    local msg="$1"
    shift
    if [[ "${DRY_RUN:-0}" == "1" ]]; then
        local __q=''
        local __a
        for __a in "$@"; do
            printf -v __q '%s %q' "$__q" "$__a"
        done
        log_info "DRY-RUN: would execute:${__q}"
        return 0
    fi
    if [[ "${NON_INTERACTIVE:-0}" == "1" ]]; then
        printf '%s... ' "$msg"
        "$@"
        local rc=$?
        printf '\n'
        return $rc
    fi
    local pid spin i
    printf '%s... ' "$msg"
    "$@" & pid=$!
    local spinner='|/-\'
    i=0
    while kill -0 "$pid" 2>/dev/null; do
        i=$(( (i+1) %4 ))
        printf '\b%s' "${spinner:${i}:1}"
        sleep 0.2
    done
    wait "$pid"
    local rc=$?
    printf '\b'
    (( rc == 0 )) || printf '%sFAILED%s\n' "$RED" "$RESET" >&2
    return $rc
}

# Run a command as a given user, wrapped in a spinner
spin_as_user() {
  local user="$1"; shift
  local msg="$1"; shift
  # If we're already the correct user, no need for user-switching commands
  if [[ "$(id -u)" -eq 0 && "$user" == "root" ]] || [[ "$user" == "$(id -un)" ]]; then
    run_with_spinner "$msg" "$@"
    return $?
  fi
  # Prefer sudo, fallback to runuser for portability
  if command -v sudo >/dev/null 2>&1; then
    run_with_spinner "$msg" sudo -n -u "$user" -- "$@"
  elif command -v runuser >/dev/null 2>&1; then
    run_with_spinner "$msg" runuser -u "$user" -- "$@"
  else
    log_error "Neither 'sudo' nor 'runuser' available to switch to user '$user'"
    return 127
  fi
}

# Safe file editing with backup
safe_edit_file() {
    local file="$1"
    local edit_function="$2"
    shift 2
    
    [[ "${DRY_RUN:-0}" == "1" ]] && { log_info "DRY-RUN: would edit file: $file"; return 0; }
    
    # Validate that the edit function is actually a function
    if ! declare -F "$edit_function" >/dev/null 2>&1; then
        log_error "safe_edit_file: '$edit_function' is not a valid function"
        return 1
    fi
    
    # Use the secured $TEMP_DIR if set; otherwise fall back to default tmpdir
    local tmpopt=(--tmpdir)
    if [[ -n "$TEMP_DIR" ]]; then
        tmpopt=(--tmpdir="$TEMP_DIR")
    fi
    backup=$(mktemp "${tmpopt[@]}" "$(basename "$file").bak.XXXXXX") || return 1
    cp -a -- "$file" "$backup" || return 1
    # Ensure backup file has secure permissions AFTER copying (cp -a preserves source attributes)
    chmod 600 "$backup" || return 1
    log_debug "Backup of $file at $backup"
    
    # Call the edit function with the file path and any additional arguments
    "$edit_function" "$file" "$@"
    local rc=$?
    
    if (( rc != 0 )); then
        log_warn "Edit failed for $file; restoring original"
        cp -a -- "$backup" "$file" || log_error "Restore failed; backup at $backup"
    fi
    return $rc
}

# Result tracking
track_result() {
    local status="$1"
    local message="$2"
    
    case "$status" in
        changed) CHANGED_ITEMS+=("$message"); status_ok "$message" ;;
        skipped) SKIPPED_ITEMS+=("$message"); status_skip "$message" ;;
        failed)  FAILED_ITEMS+=("$message"); status_fail "$message" ;;
        *) die "Invalid result status: $status" ;;
    esac
}

# Print installation summary
print_summary() {
    printf '\n'
    headline "Installation Summary:"
    
    if (( ${#CHANGED_ITEMS[@]} > 0 )); then
        subhead "Changed:"
        printf '  %s\n' "${CHANGED_ITEMS[@]}"
    fi
    
    if (( ${#SKIPPED_ITEMS[@]} > 0 )); then
        subhead "Already set/skipped:"
        printf '  %s\n' "${SKIPPED_ITEMS[@]}"
    fi
    
    if (( ${#FAILED_ITEMS[@]} > 0 )); then
        subhead "Failed:"
        printf '  %s\n' "${FAILED_ITEMS[@]}"
    fi
}

# Interactive choice selection
ask_choice() {
    local question="$1"
    local default="$2"
    shift 2
    local choices=("$@")
    local choice=""
    
    while true; do
        # All UI output should go to stderr >&2
        if [[ -n "$question" ]]; then
            hint "$question"
        fi
        local i=1
        for option in "${choices[@]}"; do
            printf '  %s%d.%s %s\n' "$CYAN" "$i" "$RESET" "$option" >&2
            ((i++))
        done
        printf '%sChoose [1-%d] (default: %s): %s' "${BOLD}${YELLOW}" "${#choices[@]}" "$default" "$RESET" >&2
        
        # Read from the tty to prevent issues with pipes
        read -r choice </dev/tty
        choice="${choice:-$default}"
        
        if [[ "$choice" =~ ^[0-9]+$ ]] && [[ "$choice" -ge 1 ]] && [[ "$choice" -le ${#choices[@]} ]]; then
            printf '%sSelected:%s %s\n\n' "${BOLD}${BLUE}" "$RESET" "${choices[$((choice-1))]}" >&2
            # The actual return value goes to stdout
            printf '%s' "$choice"
            return 0
        else
            warning "Invalid choice '$choice'. Please select a number between 1 and ${#choices[@]}."
            printf '\n' >&2
        fi
    done
}

# Yes/no questions
ask_yesno() {
    local question="$1"
    local default="$2"
    local default_display
    [[ "$default" =~ ^[Yy]$ ]] && default_display='Y/n' || default_display='y/N'
    local answer=""
    
    while true; do
        printf '%s %s[%s]:%s ' "$question" "${YELLOW}${BOLD}" "$default_display" "$RESET" >&2
        
        # Read directly from the terminal
        read -r answer </dev/tty
        answer="${answer:-$default}"
        answer="${answer,,}"  # Convert to lowercase
        
        case "$answer" in
            y|yes) 
                printf '%sAnswer:%s yes\n\n' "${BOLD}${BLUE}" "$RESET" >&2
                printf 'yes'
                return 0 
                ;;
            n|no)  
                printf '%sAnswer:%s no\n\n'  "${BOLD}${BLUE}" "$RESET" >&2
                printf 'no'
                return 0 
                ;;
            *) 
                warning "Please answer 'y' (yes) or 'n' (no)."
                ;;
        esac
    done
}

# Configuration collection
collect_user_preferences() {
    if [[ "${NON_INTERACTIVE:-0}" == "1" ]]; then
        log_info "Non-interactive mode: using environment variables and defaults"
        return 0
    fi
    
    headline "Minimal Fedora GNOME Install"
    printf '\n'
    
    # License display
    headline "License:"
    subhead "MIT No Attribution License"
    emph "Copyright 2025 Cadric"
    printf '\n'
    muted <<EOF
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, includin[...]
EOF
    printf '\n'
    warning <<EOF
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT[...]
EOF
    printf '\n'
    
    headline "Configuration Questions:"
    printf 'Please answer the following questions before installation begins.\n\n'
    
    # Collect preferences based on environment or interactively
    local scope_choice="2"  # Default to user
    local install_apps_choice="no"
    local install_wallpapers_choice="no" 
    local extension_style_choice="1"
    local hide_grub_choice="no"
    
    # Override from environment if set
    if [[ -n "${MFGI_FORCE_SCOPE:-}" ]]; then
        case "$MFGI_FORCE_SCOPE" in
            system) scope_choice="1" ;;
            user) scope_choice="2" ;;
        esac
    else
        hint "GNOME Extensions are always installed for the current user."
        muted "This question is about where Flatpak applications should live."
        scope_choice="$(ask_choice "How should Flatpak applications be installed?" 2 \
                       "System-wide (available to all users)" \
                       "For the current user only (recommended for single-user systems)")"
    fi
    
    if [[ -n "${MFGI_INSTALL_APPS:-}" ]]; then
        install_apps_choice="${MFGI_INSTALL_APPS,,}"
    else
        hint "Install a curated set of useful GNOME and essential applications?"
        muted "• Includes: Calculator, Text Editor, Image Viewer, Music Player, Firefox, and Extension Manager."
        install_apps_choice="$(ask_yesno "Install this recommended app bundle?" "n")"
    fi
    
    if [[ -n "${MFGI_INSTALL_WALLPAPERS:-}" ]]; then
        install_wallpapers_choice="${MFGI_INSTALL_WALLPAPERS,,}"
    else
        hint "Install a custom wallpaper set that supports both light and dark modes?"
        install_wallpapers_choice="$(ask_yesno "Set up these custom wallpapers?" "n")"
    fi
    
    if [[ -n "${MFGI_STYLE:-}" ]]; then
        extension_style_choice="$MFGI_STYLE"
    else
        extension_style_choice="$(ask_choice "Which style (extensions) do you want installed and enabled:" 1 \
                       "GNOME Default (No extensions)" \
                       "Windows style (Dash to Panel + ArcMenu + Tray Icons)" \
                       "macOS style (Dash to Dock + Tray Icons)")"
    fi
    
    if [[ -n "${MFGI_SKIP_GRUB:-}" ]]; then
        hide_grub_choice="${MFGI_SKIP_GRUB,,}"
    else
        hide_grub_choice="$(ask_yesno "Do you wish to hide GRUB and boot directly to GNOME?" "n")"
    fi
    
    # Store choices globally as readonly to prevent accidental overrides
    readonly USER_FLATPAK_SCOPE="$scope_choice"
    readonly USER_INSTALL_APPS="$install_apps_choice"  
    readonly USER_INSTALL_WALLPAPERS="$install_wallpapers_choice"
    readonly USER_EXTENSION_STYLE="$extension_style_choice"
    readonly USER_HIDE_GRUB="$hide_grub_choice"
    
    # Show summary
    printf '\n'
    headline "Configuration Summary:"
    local scope_text
    [[ "$scope_choice" == "1" ]] && scope_text="System-wide" || scope_text="Current user only"
    printf '%s• Flatpak scope:%s %s\n' "$CYAN" "$RESET" "$scope_text"
    printf '%s• Install curated apps:%s %s\n' "$CYAN" "$RESET" "$install_apps_choice"
    printf '%s• Install wallpapers:%s %s\n' "$CYAN" "$RESET" "$install_wallpapers_choice"
    local style_names=("GNOME Default" "Windows style" "macOS style")
    printf '%s• Extension style:%s %s\n' "$CYAN" "$RESET" "${style_names[$((extension_style_choice-1))]}"
    printf '%s• Hide GRUB menu:%s %s\n' "$CYAN" "$RESET" "$hide_grub_choice"
    printf '\n'
    
    if [[ "$(ask_yesno "Proceed with installation using these settings?" "y")" == "no" ]]; then
        warning "Installation cancelled by user."
        exit 0
    fi
    
    headline "Starting installation..."
    printf '\n'
}

# Package installation
install_base_packages() {
    subhead "Installing core system packages..."
    
    local packages=(
        "gnome-shell"
        "gnome-console" 
        "nautilus"
        "gnome-software"
        "gnome-disks"
        "gettext"
        "git"
        "patch"
        "patchutils"
        "unzip"
        "tar"
        "gzip"
        "curl"
        "jq"
        "python3"
        "python3-pip"
    )
    
    if ! run_with_spinner "Updating dnf cache" dnf -y makecache; then
        warning "DNF makecache failed, continuing anyway..."
    fi

    if ! run_with_spinner "Upgrading system packages" dnf upgrade -y --refresh; then
        warning "DNF upgrade failed, continuing anyway..."
    fi
    
    if run_with_spinner "Installing packages: ${packages[*]}" \
        dnf -y --setopt=install_weak_deps=False install "${packages[@]}"; then
        track_result "changed" "dnf: installed ${packages[*]}"
    else
        track_result "failed" "dnf: error installing packages"
        return 1
    fi
}

# Remove unwanted packages
remove_unwanted_packages() {
    subhead "Removing unwanted GNOME applications..."
    
    local unwanted=(
        "gnome-tour"
        "gnome-color-manager"
        "malcontent-control"
        "malcontent-ui-libs"
    )
    
    if [[ "${DRY_RUN:-0}" == "1" ]]; then
        log_info "DRY-RUN: would check and remove packages: ${unwanted[*]}"
        track_result "changed" "Unwanted packages: would be removed"
        return 0
    fi
    
    # Check which packages are actually installed
    local to_remove=()
    for p in "${unwanted[@]}"; do
        rpm -q "$p" &>/dev/null && to_remove+=("$p")
    done
    
    if (( ${#to_remove[@]} > 0 )); then
        if dnf -y remove "${to_remove[@]}"; then
            track_result "changed" "Removed: ${to_remove[*]}"
        else
            track_result "failed" "DNF remove failed"
        fi
    else
        track_result "skipped" "No unwanted GNOME packages present"
    fi
}

# Flatpak configuration
configure_flatpak() {
    subhead "Configuring Flatpak and Flathub..."
    
    if ! command -v flatpak >/dev/null 2>&1; then
        muted "flatpak command not found — installing it now..."
        if [[ "${DRY_RUN:-0}" == "1" ]]; then
            log_info "DRY-RUN: would install flatpak"
        else
            dnf -y install flatpak
        fi
    fi
    
    if ! check_network; then
        warning "No internet connection detected. Skipping Flathub setup."
        track_result "skipped" "Flathub: no network"
        return 1
    fi
    
    muted "Disabling Fedora's Flatpak remotes (system + user) and preventing auto-addition..."

    if [[ "${DRY_RUN:-0}" != "1" ]]; then
        # Mask third-party services that add Fedora remotes (only if they exist)
        for u in flatpak-add-fedora-repos.service fedora-flathub.service fedora-third-party.service; do
            if systemctl cat "$u" >/dev/null 2>&1; then
                systemctl mask --now "$u" >/dev/null 2>&1 || true
            fi
        done

        # Function: disable + de-enumerate + try to delete, both by known names and by URL match
        disable_flatpak_fedora_remotes() {
            local scope_flag="$1" # --system or --user

            # Known names across Fedora versions
            local known=(fedora fedora-testing updates updates-testing)

            # Also catch everything pointing to registry.fedoraproject.org – including disabled ones
            mapfile -t byurl < <(
                flatpak remotes "$scope_flag" --show-disabled --columns=name,url 2>/dev/null \
                | awk '$2 ~ /registry\.fedoraproject\.org/ {print $1}'
            )

            # Collect and deduplicate
            mapfile -t names < <(printf '%s\n' "${known[@]}" "${byurl[@]}" | awk 'NF && !seen[$0]++')

            for r in "${names[@]}"; do
                # Disable and make them invisible for search/auto-deps
                flatpak remote-modify "$scope_flag" --disable --no-enumerate --no-use-for-deps "$r" \
                    >/dev/null 2>&1 || true

                # Also try to remove – if there are no refs, it will disappear completely
                flatpak remote-delete "$scope_flag" --noninteractive "$r" \
                    >/dev/null 2>&1 || true
            done
        }

        # System installation
        disable_flatpak_fedora_remotes --system

        # User installation
        if [[ -n "${DETECTED_USER}" && "${DETECTED_USER}" != "root" ]]; then
            run_as_user bash -lc 'set -euo pipefail
                disable_flatpak_user_remotes() {
                    local known=(fedora fedora-testing updates updates-testing)
                    mapfile -t byurl < <(flatpak remotes --user --show-disabled --columns=name,url 2>/dev/null \
                                         | awk '"'"'$2 ~ /registry\.fedoraproject\.org/ {print $1}'"'"')
                    mapfile -t names < <(printf "%s\n" "${known[@]}" "${byurl[@]}" | awk '"'"'NF && !seen[$0]++'"'"')
                    for r in "${names[@]}"; do
                        flatpak remote-modify --user --disable --no-enumerate --no-use-for-deps "$r" >/dev/null 2>&1 || true
                        flatpak remote-delete  --user --noninteractive "$r" >/dev/null 2>&1 || true
                    done
                }
                disable_flatpak_user_remotes
            '
        fi
    fi

    status_ok "Fedora Flatpak remotes are now disabled and hidden (if they existed)."
    
    
    case "${USER_FLATPAK_SCOPE:-2}" in
        1)
            if [[ "${DRY_RUN:-0}" == "1" ]]; then
                log_info "DRY-RUN: would configure Flathub system-wide"
                track_result "changed" "Flathub: would be configured (system)"
            else
                ensure_flathub "system"
                track_result "changed" "Flathub: configured (system)"
                muted "Refreshing appstream…"
                flatpak update -y --appstream --system || true
            fi
            ;;
        2)
            if [[ -n "${DETECTED_USER}" && "${DETECTED_USER}" != "root" ]]; then
                if [[ "${DRY_RUN:-0}" == "1" ]]; then
                    log_info "DRY-RUN: would configure Flathub for user: ${DETECTED_USER}"
                    track_result "changed" "Flathub: would be configured (user)"
                else
                    if run_as_user_dbus flatpak --user remote-ls flathub >/dev/null 2>&1; then
                        track_result "skipped" "Flathub: already configured (user)"
                        muted "Refreshing appstream…"
                        run_as_user_dbus flatpak update -y --appstream --user || true
                    else
                        muted "Adding Flathub remote for user: ${DETECTED_USER}"
                        ensure_flathub "user"
                        track_result "changed" "Flathub: configured (user)"
                        muted "Refreshing appstream…"
                        run_as_user_dbus flatpak update -y --appstream --user || true
                    fi
                fi
            else
                log_warn "No non-root user detected; cannot set up user-level Flathub."
                track_result "skipped" "Flathub: no non-root user"
            fi
            ;;
    esac
}

# Install curated Flatpak applications
install_curated_flatpaks() {
    if [[ "${USER_INSTALL_APPS:-no}" != "yes" ]]; then
        track_result "skipped" "Curated Flatpaks: not selected"
        return 0
    fi

    subhead "Installing curated Flatpak applications..."

    local apps=(
        "org.gnome.Calculator"
        "org.gnome.Showtime"
        "org.gnome.TextEditor"
        "org.gnome.Loupe"
        "org.gnome.Decibels"
        "org.mozilla.firefox"
        "page.tesk.Refine"
        "io.github.flattool.Ignition"
        "com.mattjakeman.ExtensionManager"
    )

    local scope="user"
    if [[ "${USER_FLATPAK_SCOPE:-2}" == "1" ]]; then
        scope="system"
    fi

    if [[ "${DRY_RUN:-0}" == "1" ]]; then
        for app in "${apps[@]}"; do
            log_info "DRY-RUN: would install $app ($scope scope)"
            track_result "changed" "Flatpak: would install $app"
        done
        return 0
    fi

    # Use the new install_flatpaks function
    install_flatpaks "$scope" "${apps[@]}"
}


# Wallpaper installation
png_signature_ok() {
    [[ -s "$1" ]] || return 1
    local signature
    signature=$(od -An -t x1 -N 8 "$1" 2>/dev/null | tr -d ' \n') || return 1
    [[ "$signature" == "89504e470d0a1a0a" ]]
}

write_png_from_base64() {
    local base64_data="$1"
    local output_file="$2"
    umask 022
    printf '%s' "$base64_data" | base64 -d >"$output_file" 2>/dev/null || return 1
    png_signature_ok "$output_file"
}

fetch_png_from_url() {
    local url="$1"
    local output_file="$2"
    umask 022
    
    if ! command -v curl >/dev/null 2>&1; then
        muted "Installing curl for wallpaper download..."
        if [[ "${DRY_RUN:-0}" != "1" ]]; then
            dnf -y install curl
        fi
    fi
    
    if [[ "${DRY_RUN:-0}" == "1" ]]; then
        log_info "DRY-RUN: would download $url to $output_file"
        return 0
    fi
    
    curl --fail --location --show-error \
         --proto '=https' --proto-redir '=https' \
         --retry 3 --retry-delay 1 \
         --silent --output "$output_file" "$url" || return 1
    png_signature_ok "$output_file"
}

install_wallpapers() {
    if [[ "${USER_INSTALL_WALLPAPERS:-no}" != "yes" ]]; then
        track_result "skipped" "Wallpapers: not selected"
        return 0
    fi
    
    subhead "Installing custom wallpapers..."
    
    local wallpaper_dir="${MFGI_WALL_DIR:-/usr/share/backgrounds/mfgi}"
    local light_wallpaper="$wallpaper_dir/light.png"
    local dark_wallpaper="$wallpaper_dir/dark.png"
    local have_light=0
    local have_dark=0
    
    if [[ "${DRY_RUN:-0}" == "1" ]]; then
        log_info "DRY-RUN: would install wallpapers to $wallpaper_dir"
        track_result "changed" "Wallpapers: would be installed"
        return 0
    fi
    
    mkdir -p "$wallpaper_dir"
    
    # Try to get wallpapers from base64 environment variables first
    if [[ -n "${MFGI_WALL_LIGHT_B64:-}" ]]; then
        if write_png_from_base64 "$MFGI_WALL_LIGHT_B64" "$light_wallpaper"; then
            have_light=1
            status_ok "Light wallpaper written from base64 data"
        else
            warning "Invalid light wallpaper base64 data"
        fi
    fi
    
    if [[ -n "${MFGI_WALL_DARK_B64:-}" ]]; then
        if write_png_from_base64 "$MFGI_WALL_DARK_B64" "$dark_wallpaper"; then
            have_dark=1
            status_ok "Dark wallpaper written from base64 data"
        else
            warning "Invalid dark wallpaper base64 data"
        fi
    fi
    
    # If we don't have both wallpapers, try to download from web
    if (( ! have_light || ! have_dark )); then
        if check_network; then
            muted "Fetching missing wallpapers from the web..."
            if (( ! have_light )); then
                if fetch_png_from_url "https://arcanes.dk/mfgi/light.png" "$light_wallpaper"; then
                    have_light=1
                    status_ok "Light wallpaper downloaded"
                fi
            fi
            if (( ! have_dark )); then
                if fetch_png_from_url "https://arcanes.dk/mfgi/dark.png" "$dark_wallpaper"; then
                    have_dark=1
                    status_ok "Dark wallpaper downloaded"
                fi
            fi
        else
            warning "No network connection and no base64 data - cannot fetch wallpapers"
        fi
    fi
    
    # Check if we have at least one wallpaper
    if (( ! have_light && ! have_dark )); then
        track_result "failed" "Wallpapers: no wallpapers available after all attempts"
        return 1
    fi
    
    # Copy missing wallpaper from the other one
    if (( ! have_light )); then
        cp -f "$dark_wallpaper" "$light_wallpaper"
        status_warn "Light wallpaper missing, copied from dark wallpaper"
    fi
    if (( ! have_dark )); then
        cp -f "$light_wallpaper" "$dark_wallpaper"
        status_warn "Dark wallpaper missing, copied from light wallpaper"
    fi
    
    # Set proper permissions
    chmod 0644 "$light_wallpaper" "$dark_wallpaper"
    
    # Apply wallpapers for the current user
    if [[ -n "${DETECTED_USER}" && "${DETECTED_USER}" != "root" ]]; then
        local light_uri="file://$light_wallpaper"
        local dark_uri="file://$dark_wallpaper"
        
        muted "Applying wallpapers for user '${DETECTED_USER}' via gsettings..."
        muted "Setting GNOME background keys:"
        muted "  org.gnome.desktop.background picture-uri = '$light_uri'"
        muted "  org.gnome.desktop.background picture-uri-dark = '$dark_uri'"
        muted "  org.gnome.desktop.background picture-options = 'zoom'"
        muted "  org.gnome.desktop.screensaver picture-uri = '$dark_uri'"
        
        # Call gsettings with properly separated/escaped arguments (no shell -c)
        if \
           run_as_user_dbus gsettings set org.gnome.desktop.background picture-uri       "$light_uri" && \
           run_as_user_dbus gsettings set org.gnome.desktop.background picture-uri-dark "$dark_uri"  && \
           run_as_user_dbus gsettings set org.gnome.desktop.background picture-options  "zoom"       && \
           run_as_user_dbus gsettings set org.gnome.desktop.screensaver picture-uri     "$dark_uri"
        then
            track_result "changed" "Wallpapers: applied for current session"
            log_info "GNOME background keys configured for user ${DETECTED_USER}"
            log_info "  picture-uri: $light_uri"
            log_info "  picture-uri-dark: $dark_uri" 
            log_info "  picture-options: zoom"
            log_info "  screensaver picture-uri: $dark_uri"
        else
            track_result "changed" "Wallpapers: installed (will take effect on next login)"
            warning "Could not apply wallpapers to current session - changes will be visible after logout/login"
            muted "gsettings configuration failed - wallpapers set but not applied to current session"
        fi
        
        # Note about when changes take effect
        muted "Note: Some wallpaper changes may only be visible after logging out and back in"
    else
        log_warn "No non-root user detected; skipping per-user wallpaper settings"
        track_result "changed" "Wallpapers: installed system-wide only"
    fi
    
    # Set up vendor defaults for new users (optional)
    if [[ "${MFGI_WALL_VENDOR_DEFAULTS:-0}" == "1" ]]; then
        muted "Writing vendor defaults (dconf) for new users..."
        mkdir -p /etc/dconf/db/local.d /etc/dconf/profile
        
        cat >/etc/dconf/db/local.d/30-mfgi-wallpaper <<EOF
[org/gnome/desktop/background]
picture-uri='file://$light_wallpaper'
picture-uri-dark='file://$dark_wallpaper'
picture-options='zoom'

[org/gnome/desktop/screensaver]
picture-uri='file://$dark_wallpaper'
EOF
        
        if [[ -f /etc/dconf/profile/user ]]; then
            grep -q '^system-db:local$' /etc/dconf/profile/user || echo 'system-db:local' >> /etc/dconf/profile/user
        else
            printf '%s\n%s\n' 'user-db:user' 'system-db:local' > /etc/dconf/profile/user
        fi
        
        dconf update || true
        status_ok "dconf vendor defaults updated"
    fi
}
ensure_gext_for_user() {
    subhead "Ensuring 'gnome-extensions-cli' (gext) is installed for user: ${DETECTED_USER}"
    
    if [[ "${DRY_RUN:-0}" == "1" ]]; then
        log_info "DRY-RUN: would install gext for user ${DETECTED_USER}"
        return 0
    fi
    
    # Check if gext is already available
    if run_as_user bash -lc 'command -v gext &>/dev/null'; then
        status_ok "gext is already installed and in PATH."
        return 0
    fi
    
    # Try pipx first
    muted "Attempting to install gext via pipx..."
    if ! command -v pipx >/dev/null 2>&1; then
        muted "pipx not found, installing it now..."
        dnf -y install pipx
    fi
    
    if run_as_user bash -lc 'command -v pipx &>/dev/null'; then
        run_as_user bash -lc 'pipx ensurepath' &>/dev/null || true
        if run_as_user bash -lc 'pipx install gnome-extensions-cli' &>/dev/null; then
            if run_as_user bash -lc 'command -v gext &>/dev/null'; then
                status_ok "Successfully installed gext via pipx."
                return 0
            fi
        fi
    fi
    
    muted "pipx failed, trying pip --user as fallback..."
    if run_as_user bash -lc 'python3 -m pip install --user --break-system-packages --disable-pip-version-check --quiet gnome-extensions-cli'; then
        if run_as_user bash -lc '[[ -x "$HOME/.local/bin/gext" ]]'; then
            status_ok "Successfully installed gext via pip --user."
            return 0
        fi
    fi
    
    log_warn "FAILED: Could not install or find gnome-extensions-cli for ${DETECTED_USER}."
    return 1
}

# Helper function to install and enable GNOME extensions
install_and_enable_extension() {
    local extension="$1"
    
    muted "Installing extension: $extension"
    if run_as_user bash -lc "gext install '$extension'"; then
        track_result "changed" "Extension: installed $extension"
        # Enable the extension
        if run_as_user_dbus gnome-extensions enable "$extension"; then
            track_result "changed" "Extension: enabled $extension"
        else
            track_result "failed" "Extension: could not enable $extension"
        fi
    else
        track_result "failed" "Extension: could not install $extension"
    fi
}

# Helper function to install multiple extensions
install_extensions_for_style() {
    local extensions=("$@")
    
    if ensure_gext_for_user; then
        for ext in "${extensions[@]}"; do
            install_and_enable_extension "$ext"
        done
    else
        track_result "failed" "Extensions: gext installation failed"
    fi
}

# Apply desktop extension style
apply_extension_style() {
    local style="${USER_EXTENSION_STYLE:-1}"
    
    if [[ -z "${DETECTED_USER}" || "${DETECTED_USER}" == "root" ]]; then
        log_warn "No non-root user found. Skipping extension style setup."
        track_result "skipped" "Extensions: no user found"
        return 0
    fi
    
    if [[ "${DRY_RUN:-0}" == "1" ]]; then
        log_info "DRY-RUN: would apply extension style $style for user ${DETECTED_USER}"
        track_result "changed" "Extensions: would apply style $style"
        return 0
    fi
    
    case "$style" in
        1)
            subhead "Applying GNOME Default style..."
            muted "Resetting window buttons to default..."
            if run_as_user_dbus gsettings reset org.gnome.desktop.wm.preferences button-layout; then
                track_result "changed" "Window buttons: reset to GNOME default"
            else
                track_result "failed" "Window buttons: could not be reset"
            fi
            ;;
        2)
            subhead "Applying Windows-like desktop style..."
            muted "Enabling minimize and maximize window buttons (Windows style)..."
            if run_as_user_dbus gsettings set org.gnome.desktop.wm.preferences button-layout ':minimize,maximize,close'; then
                track_result "changed" "Window buttons: Windows style"
            else
                track_result "failed" "Window buttons: could not be set"
            fi
            
            # Install GNOME extensions for Windows-like style
            install_extensions_for_style "${WINDOWS_EXTENSIONS[@]}"
            ;;
        3)
            subhead "Applying macOS-like desktop style..."
            muted "Enabling minimize and maximize window buttons (macOS style)..."
            if run_as_user_dbus gsettings set org.gnome.desktop.wm.preferences button-layout 'close,minimize,maximize:'; then
                track_result "changed" "Window buttons: macOS style"
            else
                track_result "failed" "Window buttons: could not be set"
            fi
            
            # Install GNOME extensions for macOS-like style
            install_extensions_for_style "${MACOS_EXTENSIONS[@]}"
            ;;
        *)
            log_warn "Unknown style '$style'; leaving default."
            track_result "skipped" "Extensions: unknown style"
            ;;
    esac
}

# System service enablement
enable_services() {
    subhead "Enabling system services and graphical target..."
    
    if [[ "${DRY_RUN:-0}" == "1" ]]; then
        log_info "DRY-RUN: would enable services and set graphical target"
        track_result "changed" "Services: would be enabled"
        return 0
    fi
    
    if LC_ALL=C systemctl list-unit-files --type=service --no-legend | grep -q '^NetworkManager\.service$'; then
        systemctl enable --now NetworkManager || warning "Could not enable NetworkManager."
    fi
    
    systemctl set-default graphical.target
    track_result "changed" "System target set to 'graphical'"
}

# GRUB configuration edit function
_edit_grub_config() {
    local grub_file="$1"
    
    # Helper to update a line or add it if it's missing.
    # Uses # as a separator to avoid conflicts with paths in values.
    update_or_add() {
        local key="$1"
        local value="$2"
        # Check if the line (commented or not) exists
        if grep -qE "^\s*#?\s*${key}=" "$grub_file"; then
            # Update existing line, removing any leading comment
            sed -i.bak "s|^\s*#*\s*${key}=.*|${key}=${value}|" "$grub_file"
        else
            # Add the line at the end of the file
            printf '\n%s=%s\n' "$key" "$value" >> "$grub_file"
        fi
        return $?
    }
    
    update_or_add "GRUB_TIMEOUT_STYLE" "hidden" || return 1
    update_or_add "GRUB_TIMEOUT" "0" || return 1
    update_or_add "GRUB_RECORDFAIL_TIMEOUT" "0" || return 1
    
    return 0
}

# GRUB configuration
configure_grub() {
    if [[ "${USER_HIDE_GRUB:-no}" != "yes" ]]; then
        track_result "skipped" "GRUB: not changed"
        return 0
    fi
    
    subhead "Configuring GRUB to hide boot menu..."
    
    if [[ "${DRY_RUN:-0}" == "1" ]]; then
        log_info "DRY-RUN: would configure GRUB to hide menu"
        track_result "changed" "GRUB: would hide boot menu"
        return 0
    fi
    
    local grub_file="/etc/default/grub"
    touch "$grub_file"
    
    if ! safe_edit_file "$grub_file" _edit_grub_config; then
        track_result "failed" "GRUB: failed to edit $grub_file"
        return 1
    fi
    
    status_ok "GRUB default file updated: $grub_file"
    
    muted "Applying GRUB configuration..."
    if [[ -d /sys/firmware/efi ]]; then
        # On EFI systems, always generate the main config at /boot/grub2/grub.cfg
        # The EFI shim at /boot/efi/EFI/fedora/grub.cfg chains to this file
        local main_config="/boot/grub2/grub.cfg"
        local efi_shim="/boot/efi/EFI/fedora/grub.cfg"
        
        if grub2-mkconfig -o "$main_config" >/dev/null 2>&1; then
            status_ok "GRUB configuration updated: $main_config"
            
            # Check if EFI shim exists and note the chaining relationship
            if [[ -f "$efi_shim" ]]; then
                muted "EFI shim detected at $efi_shim (chains to $main_config)"
            else
                muted "Note: EFI shim not found at $efi_shim - may be created on next boot"
            fi
        else
            warning "grub2-mkconfig failed for EFI system"
            track_result "failed" "GRUB: configuration update failed"
            return 1
        fi
    else
        # On BIOS systems, generate config directly
        local bios_config="/boot/grub2/grub.cfg"
        if grub2-mkconfig -o "$bios_config" >/dev/null 2>&1; then
            status_ok "GRUB configuration updated: $bios_config"
        else
            warning "grub2-mkconfig failed for BIOS system"
            track_result "failed" "GRUB: configuration update failed"
            return 1
        fi
    fi
    
    track_result "changed" "GRUB: hidden boot menu configured"
}

# Main installation workflow
run_installation() {
    local steps=(
        "install_base_packages"
        "remove_unwanted_packages" 
        "configure_flatpak"
        "install_curated_flatpaks"
        "install_wallpapers"
        "apply_extension_style"
        "enable_services"
        "configure_grub"
    )
    
    log_info "Starting installation with ${#steps[@]} steps"
    
    local step_number=1
    local total_steps=${#steps[@]}
    
    for step in "${steps[@]}"; do
        log_info "[$step_number/$total_steps] Executing step: $step"
        if ! "$step"; then
            log_error "Step failed: $step"
            # In a real-world scenario, you might want to stop here.
            # For this script, we'll continue to report all failures.
        fi
        ((step_number++))
    done
    
    log_info "Installation run completed"
}

# Argument parsing
parse_arguments() {
    local dry_run=0
    local scope="${MFGI_FORCE_SCOPE:-user}"
    local install_apps="${MFGI_INSTALL_APPS:-no}"
    local install_wallpapers="${MFGI_INSTALL_WALLPAPERS:-no}"
    local extension_style="${MFGI_STYLE:-1}"
    local hide_grub="${MFGI_SKIP_GRUB:-no}"
    local has_args=0
    
    while [[ $# -gt 0 ]]; do
        has_args=1
        case $1 in
            -n|--dry-run)
                dry_run=1
                shift
                ;;
            -s|--scope)
                [[ -n "${2:-}" ]] || die "Option $1 requires an argument"
                scope="$2"
                shift 2
                ;;
            -a|--install-apps)
                [[ -n "${2:-}" ]] || die "Option $1 requires an argument"
                install_apps="$2"
                shift 2
                ;;
            -w|--install-wallpapers)
                [[ -n "${2:-}" ]] || die "Option $1 requires an argument"
                install_wallpapers="$2"
                shift 2
                ;;
            -t|--style)
                [[ -n "${2:-}" ]] || die "Option $1 requires an argument"
                extension_style="$2"
                shift 2
                ;;
            -g|--hide-grub)
                [[ -n "${2:-}" ]] || die "Option $1 requires an argument"
                hide_grub="$2"
                shift 2
                ;;
            -v|--version)
                printf '%s %s\n' "$SCRIPT_NAME" "$SCRIPT_VERSION"
                exit 0
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            --)
                shift
                break
                ;;
            -*)
                die "Unknown option: $1" 2
                ;;
            *)
                break
                ;;
        esac
    done
    
    # Validate arguments
    case "$scope" in
        system|user) ;;
        *) die "Invalid scope '$scope'. Must be 'system' or 'user'" ;;
    esac
    
    case "$install_apps" in
        yes|no) ;;
        *) die "Invalid install-apps value '$install_apps'. Must be 'yes' or 'no'" ;;
    esac
    
    case "$install_wallpapers" in
        yes|no) ;;
        *) die "Invalid install-wallpapers value '$install_wallpapers'. Must be 'yes' or 'no'" ;;
    esac
    
    case "$extension_style" in
        1|2|3) ;;
        *) die "Invalid style '$extension_style'. Must be 1, 2, or 3" ;;
    esac
    
    case "$hide_grub" in
        yes|no) ;;
        *) die "Invalid hide-grub value '$hide_grub'. Must be 'yes' or 'no'" ;;
    esac
    
    # Export configuration
    readonly DRY_RUN="$dry_run"
    
    # Only set these as readonly if we have command-line arguments
    # Otherwise, they will be set as readonly by collect_user_preferences()
    if [[ "$has_args" == "1" ]]; then
        readonly USER_FLATPAK_SCOPE="$([[ "$scope" == "system" ]] && echo "1" || echo "2")"
        readonly USER_INSTALL_APPS="$install_apps"
        readonly USER_INSTALL_WALLPAPERS="$install_wallpapers"
        readonly USER_EXTENSION_STYLE="$extension_style"
        readonly USER_HIDE_GRUB="$hide_grub"
        readonly NON_INTERACTIVE=1
        log_info "Non-interactive mode: using command-line arguments"
    else
        # Set temporary defaults for interactive mode (will be overridden by collect_user_preferences)
        # These will be made readonly in collect_user_preferences()
        USER_FLATPAK_SCOPE="2"
        USER_INSTALL_APPS="no"
        USER_INSTALL_WALLPAPERS="no"
        USER_EXTENSION_STYLE="1"
        USER_HIDE_GRUB="no"
    fi
    
    if [[ "$dry_run" == "1" ]]; then
        log_info "Dry-run mode enabled"
    fi
}

# Main function
main() {
    # Initialize colors first
    init_colors
    
    # Create temp directory and immediately set up traps to ensure cleanup
    TEMP_DIR=$(mktemp -d)
    # Ensure temp directory has secure permissions
    chmod 700 "$TEMP_DIR" || die "Could not secure temporary directory"
    
    # Set up traps immediately after TEMP_DIR is assigned to prevent race condition
    trap cleanup EXIT
    trap 'die "unexpected error at line ${LINENO} (exit code $?)"' ERR
    trap 'die "Interrupted (SIGINT)"' INT
    trap 'die "Terminated (SIGTERM)"' TERM
    
    # Parse command line
    parse_arguments "$@"
    
    # Setup logging with rotation if running in terminal
    if [[ -t 1 && "${DRY_RUN:-0}" != "1" ]]; then
        if setup_logging; then
            # Redirect stdout and stderr to both terminal and log file
            exec > >(tee -a "$LOG_FILE") 2>&1
            log_info "Logging to: $LOG_FILE (max size: $((LOG_MAX_SIZE / 1024 / 1024))MB, keep: $LOG_KEEP_ROTATED rotated)"
        else
            warning "Could not setup logging to $LOG_FILE - continuing without log file"
        fi
    fi
    
    # Validate environment
    check_dependencies
    validate_system
    
    log_info "Starting $SCRIPT_NAME v$SCRIPT_VERSION"
    
    # Initialize user detection early
    detect_user || log_warn "Continuing without a detected desktop user..."
    
    # Run the proactive check
    check_user_bus_readiness
    
    # Collect user preferences (interactive mode)
    if [[ "${NON_INTERACTIVE:-0}" != "1" ]]; then
        collect_user_preferences
    fi
    
    # Run installation
    run_installation
    
    # Show summary
    print_summary
    
    # Log session completion
    if [[ -f "$LOG_FILE" ]]; then
        {
            printf '=== Session completed at %s ===\n' "$(date '+%Y-%m-%d %H:%M:%S')"
            printf 'Exit status: success\n'
            printf '=====================================\n'
        } >> "$LOG_FILE" 2>/dev/null
    fi
    
    # Final message
    if (( ${#FAILED_ITEMS[@]} > 0 )); then
        printf '\n'
        warning "mfgi v18 installation completed with ${#FAILED_ITEMS[@]} failure(s). $(emoji "🤔")"
        status_fail "Please review the summary and log file for details."
    else
        printf '\n'
        headline "mfgi v18 installation completed! $(emoji "🎉")"
        status_ok "The system is now configured. A reboot is required to see all changes."
    fi
    
    if [[ -n "$LOG_FILE" && -f "$LOG_FILE" ]]; then
        muted "A full log of this session was saved to: $LOG_FILE"
    fi
    
    # Offer to reboot (in interactive mode only)
    if [[ "${NON_INTERACTIVE:-0}" != "1" ]] && [[ "${DRY_RUN:-0}" != "1" ]]; then
        printf '\n'
        if [[ "$(ask_yesno "Do you wish to reboot the system now?" "y")" == "yes" ]]; then
            emph "Rebooting now... See you on the other side!"
            sleep 3
            reboot
        else
            printf '\n'
            subhead "Reboot deferred. What to do next:"
            printf 'To apply all changes, you will need to reboot manually.\n'
            emph "  Reboot command: sudo reboot"
            printf '\n'
            muted "Some changes (like GNOME Extensions) can be activated by restarting the shell"
            muted "(press Alt+F2, type 'r', press Enter), but a full reboot is recommended."
            printf '\n'
            status_ok "Exiting script. You can now safely close this terminal."
        fi
    fi
}

# Only run main if not being sourced
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi