#!/usr/bin/env bash
# mfgi v18 — Minimal Fedora GNOME Install (all-in-one)
#
# Enhanced with colored interactive prompts and front-loaded Q&A
# - All user questions asked upfront before installation begins
# - Colored, professional prompts with input validation
# - Extensions installed, enabled, but not configured
# - MIT-0 licensed
#
# Environment knobs (optional - will skip interactive prompts)
# MFGI_FORCE_SCOPE=system|user, MFGI_INSTALL_APPS=yes|no, MFGI_SKIP_GRUB=yes|no
# MFGI_STYLE=1..3, MFGI_INSTALL_WALLPAPERS=yes|no
# MFGI_WALL_LIGHT_B64, MFGI_WALL_DARK_B64, MFGI_WALL_DIR, MFGI_WALL_VENDOR_DEFAULTS=1

set -euo pipefail

# ---------------------- Color and Logging Setup (MUST BE FIRST) ----------------------
color_init() {
  # This check runs before any redirection, so it correctly detects the TTY.
  if { [[ -t 1 ]] || [[ -t 2 ]]; } && [[ -z "${NO_COLOR:-}" ]]; then
    local ncolors
    ncolors=$(tput colors 2>/dev/null || echo 0)
    if (( ncolors >= 8 )); then
      BOLD=$(tput bold); RESET=$(tput sgr0)
      UNDER=$(tput smul 2>/dev/null || printf ''); NOUNDER=$(tput rmul 2>/dev/null || printf '')
      DIM=$(tput dim 2>/dev/null || printf '')
      RED=$(tput setaf 1); GREEN=$(tput setaf 2); YELLOW=$(tput setaf 3)
      BLUE=$(tput setaf 4); MAGENTA=$(tput setaf 5); CYAN=$(tput setaf 6)
      return 0
    fi
  fi
  # If no color support, ensure variables are empty.
  BOLD=; RESET=; UNDER=; NOUNDER=; DIM=; RED=; GREEN=; YELLOW=; BLUE=; MAGENTA=; CYAN=
  return 1
}

# 1. Initialize colors immediately.
color_init

# 2. Now that colors are set, redirect output for logging if we're in a terminal.
if [[ -t 1 ]]; then
    LOG_FILE="/var/log/mfgi-setup.log"
    # Ensure the log file exists and is owned by root before we start writing to it.
    touch "$LOG_FILE"
    chown root:root "$LOG_FILE"
    exec > >(tee -a "$LOG_FILE") 2>&1
else
    # If not in a terminal (e.g., in a systemd service), don't log to a file.
    LOG_FILE="" # Set to empty to avoid errors in the final message.
fi

cols="${COLUMNS:-80}"; prnt(){ fold -s -w "$cols"; }

# ---------------------- Interactive Prompt Helpers ----------------------
headline()     { printf '%s%s%s\n'    "$BOLD$CYAN" "$*" "$RESET"; }
subhead()      { printf '%s%s%s\n'    "$GREEN"    "$*" "$RESET"; }
emph()         { printf '%s%s%s\n'    "$MAGENTA"  "$*" "$RESET"; }
muted()        { printf '%s%s%s\n'    "$DIM"      "$*" "$RESET"; }
warning()      { printf '%s%s%s\n'    "$BOLD$RED" "$*" "$RESET"; }
hint()         { printf '%s%s%s\n'    "$YELLOW"   "$*" "$RESET"; }
prompt_line()  { printf '%s%s%s'      "$BOLD$YELLOW" "$*" "$RESET"; }
status_ok()    { printf '%s✅ %s%s\n' "$GREEN" "$*" "$RESET"; }
status_warn()  { printf '%s⚠️  %s%s\n' "$YELLOW" "$*" "$RESET"; }
status_fail()  { printf '%s❌ %s%s\n' "$RED" "$*" "$RESET"; }

ask_choice() {
    # Usage: ask_choice "Question" default "Choice 1" "Choice 2" ...
    local question="$1" default="$2"; shift 2
    local choices=("$@")
    local choice=""
    
    while true; do
        hint "$question"
        local i=1
        for c in "${choices[@]}"; do
            printf '  %s%d.%s %s\n' "$CYAN" "$i" "$RESET" "$c"
            ((i++))
        done
        prompt_line "Choose [1-${#choices[@]}] (default: $default): "
        
        if [[ -r /dev/tty ]]; then
            read -r choice < /dev/tty
        else
            read -r choice
        fi
        
        choice="${choice:-$default}"
        
        # Validation: check if choice is a valid number in range
        if [[ "$choice" =~ ^[0-9]+$ ]] && [[ "$choice" -ge 1 ]] && [[ "$choice" -le ${#choices[@]} ]]; then
            REPLY="$choice"
            printf '%sSelected:%s %s\n\n' "$BOLD$BLUE" "$RESET" "${choices[$((choice-1))]}"
            return 0
        else
            warning "Invalid choice '$choice'. Please select a number between 1 and ${#choices[@]}."
            echo
        fi
    done
}

ask_yesno() {
    # Usage: ask_yesno "Question" default_y_or_n
    local question="$1" def="$2"
    local def_show; [[ "$def" =~ ^[Yy]$ ]] && def_show='Y/n' || def_show='y/N'
    local ans=""
    
    while true; do
        hint "$question"
        prompt_line "Answer [$def_show]: "
        
        if [[ -r /dev/tty ]]; then
            read -r ans < /dev/tty
        else
            read -r ans
        fi
        
        ans="${ans:-$def}"
        ans="${ans,,}" # to lowercase
        
        case "$ans" in
            y|yes) REPLY="yes"; printf '%sAnswer:%s yes\n\n' "$BOLD$BLUE" "$RESET"; return 0 ;;
            n|no)  REPLY="no";  printf '%sAnswer:%s no\n\n'  "$BOLD$BLUE" "$RESET"; return 0 ;;
            *) warning "Please answer 'y' (yes) or 'n' (no)." ;;
        esac
    done
}

# Global variables to store user choices
USER_FLATPAK_SCOPE=""
USER_INSTALL_APPS=""
USER_INSTALL_WALLPAPERS=""
USER_EXTENSION_STYLE=""
USER_HIDE_GRUB=""
MFGI_FLATPAK_SCOPE=""

collect_user_preferences() {
    headline "mfgi v18 — Minimal Fedora GNOME Install"
    echo
    
    # Show license
    headline "License:"
    subhead "MIT No Attribution License"
    emph "Copyright 2025 Cadric"
    echo
    muted "Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the \"Software\"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so."
    echo
    warning "THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE."
    echo
    
    headline "Configuration Questions:"
    echo "Please answer the following questions before installation begins."
    echo
    
    # 1. Flatpak scope
    if [[ -n "${MFGI_FORCE_SCOPE:-}" ]]; then
        case "$MFGI_FORCE_SCOPE" in
            system) USER_FLATPAK_SCOPE="1" ;;
            user) USER_FLATPAK_SCOPE="2" ;;
            *) USER_FLATPAK_SCOPE="1" ;;
        esac
        status_ok "Flatpak scope: ${MFGI_FORCE_SCOPE} (from environment)"
    else
        hint "GNOME Extensions are always installed for the current user."
        muted "This question is about where Flatpak applications (like LibreWolf, Flatseal, etc.) should live."
        ask_choice "How should Flatpak applications be installed?" 2 \
                   "System-wide (available to all users)" \
                   "For the current user only (recommended for single-user systems)"
        USER_FLATPAK_SCOPE="$REPLY"
    fi
    
    # 2. Curated apps
    if [[ -n "${MFGI_INSTALL_APPS:-}" ]]; then
        case "${MFGI_INSTALL_APPS,,}" in
            yes|y) USER_INSTALL_APPS="yes" ;;
            *) USER_INSTALL_APPS="no" ;;
        esac
        status_ok "Curated apps: $USER_INSTALL_APPS (from environment)"
    else
        hint "Install a curated set of useful, open-source Flatpak applications?"
        muted "• Includes: Extension Manager, Flatseal, LibreWolf, and other system utilities."
        ask_yesno "Install this recommended app bundle?" "n"
        USER_INSTALL_APPS="$REPLY"
    fi
    
    # 3. Wallpapers
    if [[ -n "${MFGI_INSTALL_WALLPAPERS:-}" ]]; then
        case "${MFGI_INSTALL_WALLPAPERS,,}" in
            yes|y) USER_INSTALL_WALLPAPERS="yes" ;;
            *) USER_INSTALL_WALLPAPERS="no" ;;
        esac
        status_ok "Wallpapers: $USER_INSTALL_WALLPAPERS (from environment)"
    else
        hint "Install a custom wallpaper set that supports both light and dark modes?"
        muted "• A matching pair of minimal wallpapers will be downloaded and applied."
        ask_yesno "Set up these custom wallpapers?" "n"
        USER_INSTALL_WALLPAPERS="$REPLY"
    fi
    
    # 4. Extension style
    if [[ -n "${MFGI_STYLE:-}" ]]; then
        case "$MFGI_STYLE" in
            1|2|3) USER_EXTENSION_STYLE="$MFGI_STYLE" ;;
            *) USER_EXTENSION_STYLE="1" ;;
        esac
        status_ok "Extension style: choice $USER_EXTENSION_STYLE (from environment)"
    else
        ask_choice "Which style (extensions) do you want installed and enabled:" 1 \
                   "GNOME Default (No extensions)" \
                   "Windows style (Dash to Panel + ArcMenu + Tray Icons)" \
                   "macOS style (Dash to Dock + Tray Icons)"
        USER_EXTENSION_STYLE="$REPLY"
    fi
    
    # 5. GRUB hiding
    if [[ -n "${MFGI_SKIP_GRUB:-}" ]]; then
        case "${MFGI_SKIP_GRUB,,}" in
            yes|y) USER_HIDE_GRUB="yes" ;;
            *) USER_HIDE_GRUB="no" ;;
        esac
        status_ok "Hide GRUB: $USER_HIDE_GRUB (from environment)"
    else
        ask_yesno "Do you wish to hide GRUB and boot directly to GNOME?" "n"
        USER_HIDE_GRUB="$REPLY"
    fi
    
    # Summary
    echo
    headline "Configuration Summary:"
    local scope_text=$([ "$USER_FLATPAK_SCOPE" = "1" ] && echo "System-wide" || echo "Current user only")
    printf "%s• Flatpak scope:%s %s\n" "$CYAN" "$RESET" "$scope_text"
    printf "%s• Install curated apps:%s %s\n" "$CYAN" "$RESET" "$USER_INSTALL_APPS"
    printf "%s• Install wallpapers:%s %s\n" "$CYAN" "$RESET" "$USER_INSTALL_WALLPAPERS"
    local style_names=("GNOME Default" "Windows style" "macOS style")
    printf "%s• Extension style:%s %s\n" "$CYAN" "$RESET" "${style_names[$((USER_EXTENSION_STYLE-1))]}"
    printf "%s• Hide GRUB menu:%s %s\n" "$CYAN" "$RESET" "$USER_HIDE_GRUB"
    echo
    
    ask_yesno "Proceed with installation using these settings?" "y"
    if [[ "$REPLY" = "no" ]]; then
        warning "Installation cancelled by user."
        exit 0
    fi
    
    headline "Starting installation..."
    echo
}

# ---------------------- System Functions ----------------------
need_root(){
    if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
        warning "This installer must run as root."
        emph "Please run 'sudo bash $0' or 'sudo su -' first."
        exit 1
    fi
}

check_fedora(){
    [[ -r /etc/os-release ]] || { echo "/etc/os-release missing"|prnt; exit 1; }
    . /etc/os-release
    [[ "${ID:-}" == "fedora" ]] || { echo "This installer targets Fedora. Detected: ${NAME:-unknown}."|prnt; exit 1; }
    status_ok "Detected Fedora ${VERSION_ID:-?}."
}

ensure_cmd(){
    command -v "$1" >/dev/null 2>&1 || { status_fail "Required command missing: $1"; exit 1; }
}

dnf_install(){
    if ! dnf -y makecache; then
        warning "WARNING: 'dnf makecache' failed. Continuing anyway..."
    fi
    if ! dnf -y --setopt=install_weak_deps=False install "$@"; then
        status_fail "ERROR: Failed to install packages: $*"
        exit 1
    fi
}

detect_primary_user(){
    local u=""
    if [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != root ]]; then
        u="$SUDO_USER"
    fi
    if [[ -z "$u" ]]; then
        u="$(logname 2>/dev/null || true)"
    fi
    if [[ -z "$u" || "$u" == root ]]; then
        u="$(awk -F: '$3>=1000 && $1!="nobody" {print $1; exit}' /etc/passwd 2>/dev/null || true)"
    fi
    echo "$u"
}

as_user(){
    local u="$1"; shift
    if [[ -z "$u" || "$u" == root ]]; then
        "$@"
    else
        local cmd; printf -v cmd '%q ' "$@"
        su - "$u" -s /bin/bash -c "$cmd"
    fi
}

as_user_dbus(){
    local u="$1"; shift
    if [[ -z "$u" || "$u" == root ]]; then
        dbus-run-session "$@"
    else
        local cmd; printf -v cmd '%q ' "$@"
        su - "$u" -s /bin/bash -c "dbus-run-session $cmd"
    fi
}

net_ready(){
    if command -v nm-online >/dev/null 2>&1; then
        nm-online -q -t 15 && return 0
    fi
    if getent ahosts extensions.gnome.org >/dev/null 2>&1; then
        (exec 3<>/dev/tcp/extensions.gnome.org/443) 2>/dev/null && exec 3>&- && return 0
    fi
    if command -v ping >/dev/null 2>&1; then
        ping -c1 -W3 1.1.1.1 >/dev/null 2>&1 && return 0
    fi
    return 1
}

# ---------------------- Installation Steps ----------------------
install_base(){
    subhead "Installing core system packages..."
    dnf_install gnome-shell gnome-terminal nautilus gnome-software gnome-disks
    subhead "Installing helper packages..."
    dnf_install gettext git patch patchutils unzip tar gzip curl python3 python3-pip
}

remove_unwanted_gnome_bits(){
    subhead "Removing unwanted GNOME applications..."
    dnf -y remove gnome-tour gnome-color-manager malcontent-control malcontent-ui-libs || true
}

ensure_gext_for_user(){
    local u; u="$(detect_primary_user)"
    [[ -z "$u" || "$u" == root ]] && return 1
    
    subhead "Ensuring 'gnome-extensions-cli' (gext) is installed for user: $u"
    
    # Check if gext is already available in the user's path
    if as_user "$u" bash -lc 'command -v gext &>/dev/null'; then
        status_ok "gext is already installed and in PATH."
        return 0
    fi
    
    muted "Attempting to install gext via pip --user..."
    if as_user "$u" bash -lc 'python3 -m pip install --user --break-system-packages --disable-pip-version-check --quiet gnome-extensions-cli'; then
        if as_user "$u" bash -lc '[[ -x "$HOME/.local/bin/gext" ]]'; then
            status_ok "Successfully installed gext via pip --user."
            return 0
        fi
    fi
    
    muted "pip --user failed or gext not found, trying pipx..."
    if ! command -v pipx >/dev/null 2>&1; then
        muted "pipx not found, installing it now..."
        dnf_install pipx
    fi
    
    if as_user "$u" bash -lc 'command -v pipx &>/dev/null'; then
        as_user "$u" bash -lc 'pipx ensurepath' &>/dev/null || true
        if as_user "$u" bash -lc 'pipx install gnome-extensions-cli' &>/dev/null; then
            if as_user "$u" bash -lc 'command -v gext &>/dev/null'; then
                 status_ok "Successfully installed gext via pipx."
                 return 0
            fi
        fi
    fi
    
    warning "FAILED: Could not install or find gnome-extensions-cli for $u."
    return 1
}

gext_install_extension(){
    local u="$1" ident="$2" uuid="$3"
    echo
    subhead "Installing extension '$ident'..."
    
    # Construct a command that forces the PATH to be correct inside the su shell
    local cmd="export PATH=\$HOME/.local/bin:\$PATH; gext install '$ident'"

    if as_user "$u" bash -c "$cmd"; then
        status_ok "Installation command for '$ident' completed."
        sleep 1
        if as_user "$u" bash -lc "test -d \"\$HOME/.local/share/gnome-shell/extensions/$uuid\""; then
            status_ok "Verified: '$ident' is present in the filesystem."
            return 0
        else
            warning "Installation of '$ident' reported success but verification failed."
            return 1
        fi
    else
        status_fail "Installation failed for '$ident'."
        return 1
    fi
}

enable_installed_extensions(){
    local u="$1"; shift
    local add=("$@")
    echo
    subhead "Enabling installed extensions for user $u..."
    
    local cur
    cur=$(as_user_dbus "$u" bash -lc "gsettings get org.gnome.shell enabled-extensions" 2>/dev/null || echo "[]")
    
    local merged
    merged=$(python3 - "$cur" "${add[@]}" <<'PY'
import ast, sys
try:
    cur = ast.literal_eval(sys.argv[1])
    if not isinstance(cur, list): cur = []
except: cur = []
new = [ext for ext in sys.argv[2:] if ext not in cur]
if not new:
    print("All required extensions were already enabled.", file=sys.stderr)
else:
    print(f"Adding to enabled list: {', '.join(new)}", file=sys.stderr)
cur.extend(new)
print("[" + ", ".join("'" + s + "'" for s in cur) + "]")
PY
    )
    
    if as_user_dbus "$u" bash -lc "gsettings set org.gnome.shell enabled-extensions \"$merged\""; then
        status_ok "Extensions enabled in GNOME Shell configuration."
    else
        status_fail "Failed to enable extensions via gsettings."
    fi
}

configure_flatpak(){
    subhead "Configuring Flatpak and Flathub..."
    
    if ! command -v flatpak >/dev/null 2>&1; then
        muted "flatpak command not found — installing it now..."
        dnf_install flatpak
    fi
    
    if ! net_ready; then
        warning "No internet connection detected. Skipping Flathub setup."
        return 1
    fi

    muted "Disabling Fedora's own Flatpak remote to ensure consistency..."
    flatpak remote-delete --system fedora >/dev/null 2>&1 || true
    flatpak remote-delete --user fedora >/dev/null 2>&1 || true
    status_ok "Fedora Flatpak remote removed (if it existed)."
    
    case "$USER_FLATPAK_SCOPE" in
        1) # system wide
            muted "Adding Flathub remote system-wide..."
            flatpak remote-add --if-not-exists --system flathub https://dl.flathub.org/repo/flathub.flatpakrepo || true
            if flatpak --system remote-ls flathub >/dev/null 2>&1; then
                MFGI_FLATPAK_SCOPE=system
                status_ok "Flathub (system) is configured."
                as_user root flatpak update -y --appstream --system || true
            else
                status_fail "Could not configure Flathub (system)."
            fi
            ;;
        2) # user only
            local u; u="$(detect_primary_user)"
            if [[ -n "$u" && "$u" != root ]]; then
                muted "Adding Flathub remote for user: $u"
                as_user "$u" flatpak remote-add --if-not-exists --user flathub https://dl.flathub.org/repo/flathub.flatpakrepo || true
                if as_user "$u" flatpak --user remote-ls flathub >/dev/null 2>&1; then
                    MFGI_FLATPAK_SCOPE=user
                    status_ok "Flathub (user: $u) is configured."
                    as_user "$u" flatpak update -y --appstream --user || true
                else
                    status_fail "Could not configure Flathub for user $u."
                fi
            else
                warning "No non-root user detected; cannot set up user-level Flathub."
            fi
            ;;
    esac
}

install_curated_flatpaks(){
    [[ -z "$MFGI_FLATPAK_SCOPE" ]] && { warning "Flathub not configured; skipping curated apps."; return 0; }
    
    subhead "Installing curated Flatpak applications..."
    
    local apps=(
        io.github.flattool.Ignition
        com.mattjakeman.ExtensionManager
        page.tesk.Refine
        com.github.tchx84.Flatseal
        net.nokyan.Resources
        io.github.flattool.Warehouse
        io.gitlab.librewolf-community
    )
    
    local install_cmd_prefix="flatpak install -y"
    local as_install_user=""
    if [[ "$MFGI_FLATPAK_SCOPE" == system ]]; then
        install_cmd_prefix+=" --system flathub"
        as_install_user="root"
    else
        install_cmd_prefix+=" --user flathub"
        as_install_user="$(detect_primary_user)"
    fi

    for app in "${apps[@]}"; do
        muted "Installing $app..."
        if as_user "$as_install_user" $install_cmd_prefix "$app"; then
            status_ok "$app installed."
        else
            status_warn "Could not install $app. Continuing..."
        fi
    done
}

# ---------------------- Wallpapers (non-interactive version) ----------------------
png_sig_ok(){
    [[ -s "$1" ]] || return 1
    local sig; sig=$(od -An -t x1 -N 8 "$1" 2>/dev/null | tr -d ' \n') || return 1
    [[ "$sig" == 89504e470d0a1a0a ]]
}

write_png_from_b64(){
    local b64="$1" out="$2"
    umask 022
    printf '%s' "$b64" | base64 -d >"$out" 2>/dev/null || return 1
    png_sig_ok "$out"
}

fetch_png(){
    local url="$1" out="$2"
    umask 022
    command -v curl >/dev/null 2>&1 || dnf_install curl
    curl -fLso "$out" "$url" || return 1
    png_sig_ok "$out"
}

install_wallpapers_noninteractive(){
    subhead "Installing custom wallpapers..."
    
    local WALL_DIR="${MFGI_WALL_DIR:-/usr/share/backgrounds/mfgi}"
    mkdir -p "$WALL_DIR"
    local light="$WALL_DIR/light.png" dark="$WALL_DIR/dark.png"
    local have_light=0 have_dark=0
    
    if [[ -n "${MFGI_WALL_LIGHT_B64:-}" ]]; then
        write_png_from_b64 "$MFGI_WALL_LIGHT_B64" "$light" && have_light=1 && status_ok "Wrote light wallpaper from base64." || warning "Invalid LIGHT base64 data."
    fi
    
    if [[ -n "${MFGI_WALL_DARK_B64:-}" ]]; then
        write_png_from_b64 "$MFGI_WALL_DARK_B64" "$dark" && have_dark=1 && status_ok "Wrote dark wallpaper from base64." || warning "Invalid DARK base64 data."
    fi
    
    if (( ! have_light || ! have_dark )); then
        if net_ready; then
            muted "Fetching missing wallpapers from the web..."
            (( ! have_light )) && fetch_png "https://arcanes.dk/mfgi/light.png" "$light" && have_light=1 && status_ok "Fetched light wallpaper." || true
            (( ! have_dark )) && fetch_png "https://arcanes.dk/mfgi/dark.png" "$dark" && have_dark=1 && status_ok "Fetched dark wallpaper." || true
        else
            warning "No network and no base64 provided — cannot fetch wallpapers."
        fi
    fi
    
    (( have_light || have_dark )) || { status_fail "No wallpapers available after all attempts."; return 1; }
    
    (( have_light )) || { cp -f "$dark" "$light"; status_warn "Missing light wallpaper, copied from dark."; }
    (( have_dark )) || { cp -f "$light" "$dark"; status_warn "Missing dark wallpaper, copied from light."; }
    chmod 0644 "$light" "$dark"
    
    local u; u="$(detect_primary_user)"
    if [[ -n "$u" && "$u" != root ]]; then
        local light_uri="file://$light" dark_uri="file://$dark"
        muted "Applying wallpapers for user '$u' via gsettings..."
        as_user_dbus "$u" bash -lc "gsettings set org.gnome.desktop.background picture-uri '$light_uri' && gsettings set org.gnome.desktop.background picture-uri-dark '$dark_uri' && gsettings set org.gnome.desktop.background picture-options 'zoom' && gsettings set org.gnome.desktop.screensaver picture-uri '$dark_uri'" && status_ok "Wallpapers applied for current session." || warning "gsettings apply failed (will likely take effect on next login)."
    else
        warning "No non-root user detected; skipping per-user wallpaper settings."
    fi
    
    if [[ "${MFGI_WALL_VENDOR_DEFAULTS:-0}" == 1 ]]; then
        muted "Writing vendor defaults (dconf) for new users..."
        mkdir -p /etc/dconf/db/local.d /etc/dconf/profile
        cat >/etc/dconf/db/local.d/30-mfgi-wallpaper <<EOF
[org/gnome/desktop/background]
picture-uri='file://$light'
picture-uri-dark='file://$dark'
picture-options='zoom'

[org/gnome/desktop/screensaver]
picture-uri='file://$dark'
EOF
        if [[ -f /etc/dconf/profile/user ]]; then
            grep -q '^system-db:local$' /etc/dconf/profile/user || echo 'system-db:local' >> /etc/dconf/profile/user
        else
            printf '%s\n%s\n' 'user-db:user' 'system-db:local' > /etc/dconf/profile/user
        fi
        dconf update || true
        status_ok "dconf vendor defaults updated."
    fi
}

# ---------------------- Desktop style presets (updated to use global state) ----------------------
apply_extension_style(){
    local style="$1"
    local u
    u="$(detect_primary_user)"
    if [[ -z "$u" || "$u" == root ]]; then
        warning "No non-root user found. Skipping extension style setup."
        return 0
    fi
    
    # This function now returns 0 on success, 1 on failure.
    if ! ensure_gext_for_user; then
        warning "Cannot proceed with extension setup without gext."
        return 0
    fi
    
    local DTP_ID=1160 DTP_UUID='dash-to-panel@jderose9.github.com'
    local ARCM_ID=3628 ARCM_UUID='arcmenu@arcmenu.com'  
    local DTD_ID=307 DTD_UUID='dash-to-dock@micxgx.gmail.com'
    local TIR_ID=2890 TIR_UUID='trayIconsReloaded@selfmade.pl'
    
    local installed_extensions=()

    case "$style" in
        1)
            subhead "Applying GNOME Default style..."
            muted "Resetting window buttons to default..."
            if as_user_dbus "$u" gsettings reset org.gnome.desktop.wm.preferences button-layout; then
                status_ok "Window buttons reset to GNOME default."
            else
                status_warn "Could not reset window button layout."
            fi
            ;;
        2)
            subhead "Applying Windows-like desktop style..."
            gext_install_extension "$u" "$DTP_ID" "$DTP_UUID" && installed_extensions+=("$DTP_UUID")
            gext_install_extension "$u" "$ARCM_ID" "$ARCM_UUID" && installed_extensions+=("$ARCM_UUID")
            gext_install_extension "$u" "$TIR_ID" "$TIR_UUID" && installed_extensions+=("$TIR_UUID")
            
            muted "Enabling minimize and maximize window buttons (Windows style)..."
            if as_user_dbus "$u" gsettings set org.gnome.desktop.wm.preferences button-layout ':minimize,maximize,close'; then
                status_ok "Window buttons set to Windows style (right-aligned)."
            else
                status_warn "Could not set window button layout."
            fi
            ;;
        3)
            subhead "Applying macOS-like desktop style..."
            gext_install_extension "$u" "$DTD_ID" "$DTD_UUID" && installed_extensions+=("$DTD_UUID")
            gext_install_extension "$u" "$TIR_ID" "$TIR_UUID" && installed_extensions+=("$TIR_UUID")

            muted "Enabling minimize and maximize window buttons (macOS style)..."
            if as_user_dbus "$u" gsettings set org.gnome.desktop.wm.preferences button-layout 'close,minimize,maximize:'; then
                status_ok "Window buttons set to macOS style (left-aligned)."
            else
                status_warn "Could not set window button layout."
            fi
            ;;
        *)
            warning "Unknown style '$style'; leaving default."
            return
            ;;
    esac
    
    if [[ ${#installed_extensions[@]} -gt 0 ]]; then
        enable_installed_extensions "$u" "${installed_extensions[@]}"
    elif [[ "$style" != "1" ]]; then
        warning "No extensions were successfully installed for the selected style."
    fi
}

enable_services(){
    subhead "Enabling system services and graphical target..."
    if systemctl list-unit-files | grep -q '^NetworkManager\.service'; then
        systemctl enable --now NetworkManager || warning "Could not enable NetworkManager."
    fi
    systemctl set-default graphical.target
    ln -sfn /usr/lib/systemd/system/graphical.target /etc/systemd/system/default.target
    status_ok "System target set to 'graphical'."
}

configure_grub_skip_menu_noninteractive(){
    subhead "Configuring GRUB to hide boot menu..."
    local f=/etc/default/grub
    touch "$f"
    
    sed -i 's/^GRUB_TIMEOUT_STYLE=.*/GRUB_TIMEOUT_STYLE=hidden/' "$f"
    grep -q '^GRUB_TIMEOUT_STYLE=' "$f" || echo 'GRUB_TIMEOUT_STYLE=hidden' >> "$f"
    
    sed -i 's/^GRUB_TIMEOUT=.*/GRUB_TIMEOUT=0/' "$f"
    grep -q '^GRUB_TIMEOUT=' "$f" || echo 'GRUB_TIMEOUT=0' >> "$f"
    
    sed -i 's/^GRUB_RECORDFAIL_TIMEOUT=.*/GRUB_RECORDFAIL_TIMEOUT=0/' "$f"
    grep -q '^GRUB_RECORDFAIL_TIMEOUT=' "$f" || echo 'GRUB_RECORDFAIL_TIMEOUT=0' >> "$f"
    
    status_ok "GRUB default file updated."
    muted "Applying GRUB configuration..."
    if [ -d /sys/firmware/efi ]; then
        grub2-mkconfig -o /boot/efi/EFI/fedora/grub.cfg >/dev/null 2>&1 || warning "grub2-mkconfig failed for EFI system."
    else
        grub2-mkconfig -o /boot/grub2/grub.cfg >/dev/null 2>&1 || warning "grub2-mkconfig failed for BIOS system."
    fi
    status_ok "GRUB configuration applied."
}

# ---------------------- main ----------------------
main(){
    # Color and logging are handled at the top of the script.
    
    need_root
    check_fedora
    ensure_cmd dnf
    ensure_cmd systemctl
    
    collect_user_preferences
    
    install_base
    remove_unwanted_gnome_bits
    configure_flatpak
    
    if [[ "$USER_INSTALL_APPS" = "yes" ]]; then
        install_curated_flatpaks
    else
        status_warn "Skipping curated Flatpaks as per user choice."
    fi
    
    if [[ "$USER_INSTALL_WALLPAPERS" = "yes" ]]; then
        install_wallpapers_noninteractive
    else
        status_warn "Skipping wallpapers as per user choice."
    fi
    
    apply_extension_style "$USER_EXTENSION_STYLE"
    
    enable_services
    
    if [[ "$USER_HIDE_GRUB" = "yes" ]]; then
        configure_grub_skip_menu_noninteractive
    else
        status_warn "Keeping default GRUB configuration as per user choice."
    fi
    
    # --- Polished final output ---
    echo
    headline "mfgi v18 installation completed! 🎉"
    status_ok "The system is now configured. A reboot is required to see all changes."
    if [[ -n "${LOG_FILE:-}" && -f "${LOG_FILE:-}" ]]; then
      muted "A full log of this session was saved to: $LOG_FILE"
    fi
    echo
    
    ask_yesno "Do you wish to reboot the system now?" "y"
    if [[ "$REPLY" = "yes" ]]; then
        emph "Rebooting now... See you on the other side!"
        sleep 3
        reboot
    else
        echo
        subhead "Reboot deferred. What to do next:"
        echo "To apply all changes, you will need to reboot manually."
        emph "  Reboot command: sudo reboot"
        echo
        muted "Some changes (like GNOME Extensions) can be activated by restarting the shell"
        muted "(press Alt+F2, type 'r', press Enter), but a full reboot is recommended."
        echo
        status_ok "Exiting script. You can now safely close this terminal."
    fi
}

main "$@"