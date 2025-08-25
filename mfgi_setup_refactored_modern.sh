#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

readonly SCRIPT_NAME="$(basename "$0")"
readonly SCRIPT_VERSION="18.0.0"
readonly LOG_FILE="${LOG_FILE:-/var/log/mfgi-setup.log}"

# Global state
TEMP_DIR=""
USER_CHOICES=()
INSTALL_RESULTS=("changed" "skipped" "failed")
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
        # Only print summary if we have initialized the tracking arrays
        if [[ -v CHANGED_ITEMS ]]; then
            print_summary
        fi
    fi
    [[ -n "$TEMP_DIR" ]] && rm -rf "$TEMP_DIR"
    return $exit_code
}

trap cleanup EXIT
trap 'die "unexpected error at line $LINENO (exit code $?)"' ERR

# Logging functions
log_debug() { [[ "${DEBUG:-0}" == "1" ]] && printf '[DEBUG] %s\n' "$*"; }
log_info()  { printf '[INFO ] %s\n' "$*"; }
log_warn()  { printf '[WARN ] %s\n' "$*" >&2; }
log_error() { printf '[ERROR] %s\n' "$*" >&2; }

# UI helper functions
headline()     { printf '%s%s%s\n'    "${BOLD}${CYAN}" "$*" "$RESET" >&2; }
subhead()      { printf '%s%s%s\n'    "$GREEN"    "$*" "$RESET" >&2; }
emph()         { printf '%s%s%s\n'    "$MAGENTA"  "$*" "$RESET" >&2; }
muted()        { printf '%s%s%s\n'    "$DIM"      "$*" "$RESET" >&2; }
warning()      { printf '%s%s%s\n'    "${BOLD}${RED}" "$*" "$RESET" >&2; }
hint()         { printf '%s%s%s\n'    "$YELLOW"   "$*" "$RESET" >&2; }
prompt_line()  { printf '%s%s%s' "${BOLD}${YELLOW}" "$*" "$RESET" >&2; }
status_ok()    { printf '%s✅ %s%s\n' "$GREEN" "$*" "$RESET" >&2; }
status_warn()  { printf '%s⚠️  %s%s\n' "$YELLOW" "$*" "$RESET" >&2; }
status_fail()  { printf '%s❌ %s%s\n' "$RED" "$*" "$RESET" >&2; }

usage() {
    cat <<'EOF'
Usage: mfgi_setup_refactored.sh [OPTIONS]

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
  DEBUG                Enable debug logging (0|1)
  NO_COLOR             Disable colored output

Examples:
  # Interactive mode (default)
  sudo ./mfgi_setup_refactored.sh

  # Non-interactive with options
  sudo ./mfgi_setup_refactored.sh --scope system --install-apps yes --style 2

  # Dry run to see what would happen
  sudo ./mfgi_setup_refactored.sh --dry-run

EOF
}

# Dependency checking
check_dependencies() {
    local deps=("dnf" "systemctl" "tput")
    local missing=()
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" >/dev/null 2>&1; then
            missing+=("$dep")
        fi
    done
    
    if [[ ${#missing[@]} -gt 0 ]]; then
        die "Missing required dependencies: ${missing[*]}"
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

# User detection
detect_primary_user() {
    local user=""
    
    if [[ -n "${SUDO_USER:-}" && "$SUDO_USER" != "root" ]]; then
        user="$SUDO_USER"
    elif user="$(logname 2>/dev/null)" && [[ "$user" != "root" ]]; then
        :  # user is already set
    else
        user="$(awk -F: '$3>=1000 && $1!="nobody" {print $1; exit}' /etc/passwd 2>/dev/null || true)"
    fi
    
    printf '%s' "$user"
}

# Execute command as specific user
run_as_user() {
    local user="$1"
    shift
    
    if [[ -z "$user" || "$user" == "root" ]]; then
        "$@"
    else
        local cmd
        printf -v cmd '%q ' "$@"
        su - "$user" -s /bin/bash -c "$cmd"
    fi
}

# Execute command as user with D-Bus session
run_as_user_dbus() {
    local user="$1"
    shift
    
    if [[ -z "$user" || "$user" == "root" ]]; then
        dbus-run-session "$@"
    else
        local cmd
        printf -v cmd '%q ' "$@"
        su - "$user" -s /bin/bash -c "dbus-run-session $cmd"
    fi
}

# Spinner for long-running commands
run_with_spinner() {
    local msg="$1"
    shift
    
    if [[ "${DRY_RUN:-0}" == "1" ]]; then
        log_info "DRY-RUN: would execute: $*"
        return 0
    fi
    
    local pid spin i
    printf '%s... ' "$msg"
    "$@" & pid=$!
    local spinner='|/-\'
    i=0
    while kill -0 "$pid" 2>/dev/null; do
        i=$(( (i+1) %4 ))
        printf '\b%s' "${spinner:$i:1}"
        sleep 0.2
    done
    wait "$pid"
    local rc=$?
    printf '\b'
    return $rc
}

# Safe file editing with backup
safe_edit_file() {
    local file="$1"
    shift
    
    if [[ "${DRY_RUN:-0}" == "1" ]]; then
        log_info "DRY-RUN: would edit file: $file"
        return 0
    fi
    
    local backup
    backup=$(mktemp --tmpdir="$TEMP_DIR" "$(basename "$file").bak.XXXXXX")
    cp -a -- "$file" "$backup"
    log_debug "Created backup of $file at $backup"
    "$@"
}

# Result tracking
track_result() {
    local status="$1"
    local message="$2"
    
    case "$status" in
        changed) CHANGED_ITEMS+=("$message"); status_ok "$message" ;;
        skipped) SKIPPED_ITEMS+=("$message"); status_ok "$message" ;;
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
    
    headline "mfgi v18 — Minimal Fedora GNOME Install"
    printf '\n'
    
    # License display
    headline "License:"
    subhead "MIT No Attribution License"
    emph "Copyright 2025 Cadric"
    printf '\n'
    muted "Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the \"Software\"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so."
    printf '\n'
    warning "THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE."
    printf '\n'
    
    headline "Configuration Questions:"
    printf 'Please answer the following questions before installation begins.\n\n'
    
    # Collect preferences based on environment or interactively
    local scope_choice="2"  # Default to user
    local apps_choice="no"
    local wallpapers_choice="no" 
    local style_choice="1"
    local grub_choice="no"
    
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
        apps_choice="${MFGI_INSTALL_APPS,,}"
    else
        hint "Install a curated set of useful, open-source Flatpak applications?"
        muted "• Includes: Extension Manager, Flatseal, LibreWolf, and other system utilities."
        apps_choice="$(ask_yesno "Install this recommended app bundle?" "n")"
    fi
    
    if [[ -n "${MFGI_INSTALL_WALLPAPERS:-}" ]]; then
        wallpapers_choice="${MFGI_INSTALL_WALLPAPERS,,}"
    else
        hint "Install a custom wallpaper set that supports both light and dark modes?"
        wallpapers_choice="$(ask_yesno "Set up these custom wallpapers?" "n")"
    fi
    
    if [[ -n "${MFGI_STYLE:-}" ]]; then
        style_choice="$MFGI_STYLE"
    else
        style_choice="$(ask_choice "Which style (extensions) do you want installed and enabled:" 1 \
                       "GNOME Default (No extensions)" \
                       "Windows style (Dash to Panel + ArcMenu + Tray Icons)" \
                       "macOS style (Dash to Dock + Tray Icons)")"
    fi
    
    if [[ -n "${MFGI_SKIP_GRUB:-}" ]]; then
        grub_choice="${MFGI_SKIP_GRUB,,}"
    else
        grub_choice="$(ask_yesno "Do you wish to hide GRUB and boot directly to GNOME?" "n")"
    fi
    
    # Store choices globally as readonly to prevent accidental overrides
    readonly USER_FLATPAK_SCOPE="$scope_choice"
    readonly USER_INSTALL_APPS="$apps_choice"  
    readonly USER_INSTALL_WALLPAPERS="$wallpapers_choice"
    readonly USER_EXTENSION_STYLE="$style_choice"
    readonly USER_HIDE_GRUB="$grub_choice"
    
    # Show summary
    printf '\n'
    headline "Configuration Summary:"
    local scope_text
    [[ "$scope_choice" == "1" ]] && scope_text="System-wide" || scope_text="Current user only"
    printf '%s• Flatpak scope:%s %s\n' "$CYAN" "$RESET" "$scope_text"
    printf '%s• Install curated apps:%s %s\n' "$CYAN" "$RESET" "$apps_choice"
    printf '%s• Install wallpapers:%s %s\n' "$CYAN" "$RESET" "$wallpapers_choice"
    local style_names=("GNOME Default" "Windows style" "macOS style")
    printf '%s• Extension style:%s %s\n' "$CYAN" "$RESET" "${style_names[$((style_choice-1))]}"
    printf '%s• Hide GRUB menu:%s %s\n' "$CYAN" "$RESET" "$grub_choice"
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
        "gnome-terminal" 
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
        log_warn "DNF makecache failed, continuing anyway..."
    fi

    if ! run_with_spinner "Upgrading system packages" dnf upgrade -y --refresh; then
        log_warn "DNF upgrade failed, continuing anyway..."
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
        log_info "DRY-RUN: would remove packages: ${unwanted[*]}"
        return 0
    fi
    
    dnf -y remove "${unwanted[@]}" || true
    track_result "changed" "Removed unwanted packages"
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
    
    
    case "${USER_FLATPAK_SCOPE:-2}" in
        1)
            if [[ "${DRY_RUN:-0}" == "1" ]]; then
                log_info "DRY-RUN: would configure Flathub system-wide"
                track_result "changed" "Flathub: would be configured (system)"
            elif flatpak --system remote-ls flathub >/dev/null 2>&1; then
                track_result "skipped" "Flathub: already configured (system)"
                flatpak update -y --appstream --system || true
            else
                muted "Adding Flathub remote system-wide..."
                if flatpak remote-add --if-not-exists --system flathub https://dl.flathub.org/repo/flathub.flatpakrepo; then
                    track_result "changed" "Flathub: configured (system)"
                    flatpak update -y --appstream --system || true
                else
                    track_result "failed" "Flathub: could not be added (system)"
                fi
            fi
            ;;
        2)
            local user
            user="$(detect_primary_user)"
            if [[ -n "$user" && "$user" != "root" ]]; then
                if [[ "${DRY_RUN:-0}" == "1" ]]; then
                    log_info "DRY-RUN: would configure Flathub for user: $user"
                    track_result "changed" "Flathub: would be configured (user)"
                elif run_as_user "$user" flatpak --user remote-ls flathub >/dev/null 2>&1; then
                    track_result "skipped" "Flathub: already configured (user)"
                    run_as_user "$user" flatpak update -y --appstream --user || true
                else
                    muted "Adding Flathub remote for user: $user"
                    if run_as_user "$user" flatpak remote-add --if-not-exists --user flathub https://dl.flathub.org/repo/flathub.flatpakrepo; then
                        track_result "changed" "Flathub: configured (user)"
                        run_as_user "$user" flatpak update -y --appstream --user || true
                    else
                        track_result "failed" "Flathub: could not be added (user)"
                    fi
                fi
            else
                warning "No non-root user detected; cannot set up user-level Flathub."
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
        "io.github.flattool.Ignition"
        "com.mattjakeman.ExtensionManager"
        "page.tesk.Refine"
        "com.github.tchx84.Flatseal"
        "net.nokyan.Resources"
        "io.github.flattool.Warehouse"
        "io.gitlab.librewolf-community"
    )
    
    local install_cmd_prefix="flatpak install -y"
    local install_user=""
    
    if [[ "${USER_FLATPAK_SCOPE:-2}" == "1" ]]; then
        install_cmd_prefix+=" --system flathub"
        install_user="root"
    else
        install_cmd_prefix+=" --user flathub"
        install_user="$(detect_primary_user)"
    fi
    
    for app in "${apps[@]}"; do
        muted "Installing $app..."
        
        if [[ "${DRY_RUN:-0}" == "1" ]]; then
            log_info "DRY-RUN: would install $app"
            track_result "changed" "Flatpak: would install $app"
            continue
        fi
        
        local full_cmd="$install_cmd_prefix $app"
        
        local script
        printf -v script '%s; run_with_spinner %q %s' \
            "$(declare -f run_with_spinner)" \
            "Installing $app" \
            "$full_cmd"
        
        if run_as_user "$install_user" bash -c "$script"; then
            track_result "changed" "Flatpak: installed $app"
        else
            if run_as_user "$install_user" flatpak info "$app" >/dev/null 2>&1; then
                track_result "skipped" "Flatpak: already installed $app"
            else
                track_result "failed" "Flatpak: could not install $app"
            fi
        fi
    done
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
    
    curl -fLso "$output_file" "$url" || return 1
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
    local user
    user="$(detect_primary_user)"
    if [[ -n "$user" && "$user" != "root" ]]; then
        local light_uri="file://$light_wallpaper"
        local dark_uri="file://$dark_wallpaper"
        
        muted "Applying wallpapers for user '$user' via gsettings..."
        local gsettings_cmd="gsettings set org.gnome.desktop.background picture-uri '$light_uri' && \
gsettings set org.gnome.desktop.background picture-uri-dark '$dark_uri' && \
gsettings set org.gnome.desktop.background picture-options 'zoom' && \
gsettings set org.gnome.desktop.screensaver picture-uri '$dark_uri'"
        
        if run_as_user_dbus "$user" bash -lc "$gsettings_cmd"; then
            track_result "changed" "Wallpapers: applied for current session"
        else
            track_result "changed" "Wallpapers: installed (will take effect on next login)"
        fi
    else
        warning "No non-root user detected; skipping per-user wallpaper settings"
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
    local user="$1"
    
    subhead "Ensuring 'gnome-extensions-cli' (gext) is installed for user: $user"
    
    if [[ "${DRY_RUN:-0}" == "1" ]]; then
        log_info "DRY-RUN: would install gext for user $user"
        return 0
    fi
    
    # Check if gext is already available
    if run_as_user "$user" bash -lc 'command -v gext &>/dev/null'; then
        status_ok "gext is already installed and in PATH."
        return 0
    fi
    
    muted "Attempting to install gext via pip --user..."
    if run_as_user "$user" bash -lc 'python3 -m pip install --user --break-system-packages --disable-pip-version-check --quiet gnome-extensions-cli'; then
        if run_as_user "$user" bash -lc '[[ -x "$HOME/.local/bin/gext" ]]'; then
            status_ok "Successfully installed gext via pip --user."
            return 0
        fi
    fi
    
    muted "pip --user failed, trying pipx..."
    if ! command -v pipx >/dev/null 2>&1; then
        muted "pipx not found, installing it now..."
        dnf -y install pipx
    fi
    
    if run_as_user "$user" bash -lc 'command -v pipx &>/dev/null'; then
        run_as_user "$user" bash -lc 'pipx ensurepath' &>/dev/null || true
        if run_as_user "$user" bash -lc 'pipx install gnome-extensions-cli' &>/dev/null; then
            if run_as_user "$user" bash -lc 'command -v gext &>/dev/null'; then
                status_ok "Successfully installed gext via pipx."
                return 0
            fi
        fi
    fi
    
    warning "FAILED: Could not install or find gnome-extensions-cli for $user."
    return 1
}

# Helper function to install and enable GNOME extensions
install_and_enable_extension() {
    local user="$1"
    local extension="$2"
    
    muted "Installing extension: $extension"
    if run_as_user "$user" bash -lc "gext install '$extension'"; then
        track_result "changed" "Extension: installed $extension"
        # Enable the extension
        if run_as_user_dbus "$user" gnome-extensions enable "$extension"; then
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
    local user="$1"
    shift
    local extensions=("$@")
    
    if ensure_gext_for_user "$user"; then
        for ext in "${extensions[@]}"; do
            install_and_enable_extension "$user" "$ext"
        done
    else
        track_result "failed" "Extensions: gext installation failed"
    fi
}

# Apply desktop extension style
apply_extension_style() {
    local style="${USER_EXTENSION_STYLE:-1}"
    local user
    user="$(detect_primary_user)"
    
    if [[ -z "$user" || "$user" == "root" ]]; then
        warning "No non-root user found. Skipping extension style setup."
        track_result "skipped" "Extensions: no user found"
        return 0
    fi
    
    if [[ "${DRY_RUN:-0}" == "1" ]]; then
        log_info "DRY-RUN: would apply extension style $style for user $user"
        track_result "changed" "Extensions: would apply style $style"
        return 0
    fi
    
    case "$style" in
        1)
            subhead "Applying GNOME Default style..."
            muted "Resetting window buttons to default..."
            if run_as_user_dbus "$user" gsettings reset org.gnome.desktop.wm.preferences button-layout; then
                track_result "changed" "Window buttons: reset to GNOME default"
            else
                track_result "failed" "Window buttons: could not be reset"
            fi
            ;;
        2)
            subhead "Applying Windows-like desktop style..."
            muted "Enabling minimize and maximize window buttons (Windows style)..."
            if run_as_user_dbus "$user" gsettings set org.gnome.desktop.wm.preferences button-layout ':minimize,maximize,close'; then
                track_result "changed" "Window buttons: Windows style"
            else
                track_result "failed" "Window buttons: could not be set"
            fi
            
            # Install GNOME extensions for Windows-like style
            local windows_extensions=(
                "dash-to-panel@jderose9.github.com"
                "arcmenu@arcmenu.com"
                "appindicatorsupport@rgcjonas.gmail.com"
            )
            install_extensions_for_style "$user" "${windows_extensions[@]}"
            ;;
        3)
            subhead "Applying macOS-like desktop style..."
            muted "Enabling minimize and maximize window buttons (macOS style)..."
            if run_as_user_dbus "$user" gsettings set org.gnome.desktop.wm.preferences button-layout 'close,minimize,maximize:'; then
                track_result "changed" "Window buttons: macOS style"
            else
                track_result "failed" "Window buttons: could not be set"
            fi
            
            # Install GNOME extensions for macOS-like style
            local macos_extensions=(
                "dash-to-dock@micxgx.gmail.com"
                "appindicatorsupport@rgcjonas.gmail.com"
            )
            install_extensions_for_style "$user" "${macos_extensions[@]}"
            ;;
        *)
            warning "Unknown style '$style'; leaving default."
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
    
    if systemctl list-unit-files | grep -q '^NetworkManager\.service'; then
        systemctl enable --now NetworkManager || warning "Could not enable NetworkManager."
    fi
    
    systemctl set-default graphical.target
    ln -sfn /usr/lib/systemd/system/graphical.target /etc/systemd/system/default.target
    track_result "changed" "System target set to 'graphical'"
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
    
    safe_edit_file "$grub_file" \
        sed -i 's/^GRUB_TIMEOUT_STYLE=.*/GRUB_TIMEOUT_STYLE=hidden/' "$grub_file"
    grep -q '^GRUB_TIMEOUT_STYLE=' "$grub_file" || echo 'GRUB_TIMEOUT_STYLE=hidden' >> "$grub_file"
    
    safe_edit_file "$grub_file" \
        sed -i 's/^GRUB_TIMEOUT=.*/GRUB_TIMEOUT=0/' "$grub_file"
    grep -q '^GRUB_TIMEOUT=' "$grub_file" || echo 'GRUB_TIMEOUT=0' >> "$grub_file"
    
    safe_edit_file "$grub_file" \
        sed -i 's/^GRUB_RECORDFAIL_TIMEOUT=.*/GRUB_RECORDFAIL_TIMEOUT=0/' "$grub_file"
    grep -q '^GRUB_RECORDFAIL_TIMEOUT=' "$grub_file" || echo 'GRUB_RECORDFAIL_TIMEOUT=0' >> "$grub_file"
    
    status_ok "GRUB default file updated."
    
    muted "Applying GRUB configuration..."
    if [[ -d /sys/firmware/efi ]]; then
        grub2-mkconfig -o /boot/efi/EFI/fedora/grub.cfg >/dev/null 2>&1 || warning "grub2-mkconfig failed for EFI system."
    else
        grub2-mkconfig -o /boot/grub2/grub.cfg >/dev/null 2>&1 || warning "grub2-mkconfig failed for BIOS system."
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
            return 1
        fi
        ((step_number++))
    done
    
    log_info "Installation completed successfully"
}

# Argument parsing
parse_arguments() {
    local dry_run=0
    local scope="${MFGI_FORCE_SCOPE:-user}"
    local install_apps="${MFGI_INSTALL_APPS:-no}"
    local install_wallpapers="${MFGI_INSTALL_WALLPAPERS:-no}"
    local style="${MFGI_STYLE:-1}"
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
                style="$2"
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
    
    case "$style" in
        1|2|3) ;;
        *) die "Invalid style '$style'. Must be 1, 2, or 3" ;;
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
        readonly USER_EXTENSION_STYLE="$style"
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
    # Initialize
    init_colors
    TEMP_DIR=$(mktemp -d)
    
    # Parse command line
    parse_arguments "$@"
    
    # Validate environment
    check_dependencies
    validate_system
    
    # Setup logging if running in terminal
    if [[ -t 1 ]] && [[ "${DRY_RUN:-0}" != "1" ]]; then
        touch "$LOG_FILE"
        chown root:root "$LOG_FILE" 2>/dev/null || true
        exec > >(tee -a "$LOG_FILE") 2>&1
    fi
    
    log_info "Starting $SCRIPT_NAME v$SCRIPT_VERSION"
    
    # Collect user preferences (interactive mode)
    if [[ "${NON_INTERACTIVE:-0}" != "1" ]]; then
        collect_user_preferences
    fi
    
    # Run installation
    if ! run_installation; then
        die "Installation failed"
    fi
    
    # Show summary
    print_summary
    
    # Final message
    printf '\n'
    headline "mfgi v18 installation completed! 🎉"
    status_ok "The system is now configured. A reboot is required to see all changes."
    
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

main "$@"
