# GitHub Copilot Instructions

## Project Overview

**mgif** is a minimal Fedora GNOME installer website with an accompanying shell script. The project demonstrates progressive web design patterns with a step-by-step installation guide.

### Architecture Components

- **Frontend**: Single-page application with scroll-based section navigation (`index.html`, `assets/`)
- **Backend**: Idempotent bash installation script served as executable (`index.sh`)
- **Styling**: Modern CSS with custom properties system and defensive patterns (`assets/css/style.css`)
- **Interactions**: ES2020+ JavaScript with IIFE namespace and CSS timing integration (`assets/js/script.js`)

### Key Design Patterns

- **CSS-JS Synchronization**: JavaScript reads timing values from CSS custom properties via `readCssTimings()` function with caching and cache invalidation
- **Defensive Programming**: IIFE namespace, localStorage debug persistence, idempotent initialization, minimal public API exposure
- **Progressive Enhancement**: Feature detection, reduced-motion support, graceful degradation for older browsers
- **Scroll-Based Navigation**: Section-by-section progression with History API integration and deep-linking support

## General Requirements

Always use modern, cutting-edge technologies as described below for all code suggestions. Prioritize clean, maintainable code with appropriate comments.

**Testing & Quality Assurance:**

- Write testable code and prioritize unit and integration tests for critical functionality.
- Recommend testing frameworks native to language ecosystems (e.g., PHPUnit, Jest).
- Suggest relevant test cases or scenarios, especially for complex implementations.

**Accessibility:**

- Ensure compliance with WCAG 2.1 guidelines, meeting at least AA level, and aim for AAA compliance whenever feasible.

---

## Project-Specific Development Workflows

### Frontend Development

**CSS Timing System**: All animations must use CSS custom properties defined in `:root`. JavaScript reads these via `readCssTimings()`:
```css
:root {
  --timing-transition: 0.3s;
  --timing-quick: 0.1s;
  --timing-highlight: 1s;
}
```
```javascript
const timings = readCssTimings(); // Returns cached millisecond values
setTimeout(() => {}, timings.transition);
```

**Section Navigation Pattern**: Use the `FedoraInstallerUI` class methods for consistent behavior:
- `#goToSection(index)` - Navigate with animations and history updates
- `#renderSectionImmediate(index)` - Jump without animations (deep linking)
- Always check `this.#isTransitioning` before navigation to prevent race conditions

**Defensive JavaScript Patterns** (required in this codebase):
- Wrap in IIFE: `(function (root) { 'use strict'; /* code */ })(globalThis);`
- Use private class fields: `#privateMethod()`, `#privateProperty`
- Cache DOM queries in constructor: `this.#sections = document.querySelectorAll('.section')`
- Implement minimal public API: expose only essential methods

### Backend Shell Script Development

**Idempotent Design**: The `index.sh` script uses `track_result()` to record all changes and can be re-run safely:
```bash
track_result "changed" "Description of what changed"
track_result "skipped" "Already in desired state" 
track_result "failed" "What failed and why"
```

**DRY_RUN Support**: All destructive operations must check `${DRY_RUN:-0}`:
```bash
if [[ "${DRY_RUN:-0}" == "1" ]]; then
    log_info "DRY-RUN: would install package"
    track_result "changed" "Package: would be installed"
    return 0
fi
```

**Error Handling Pattern**: Use the established error handling with `set -Eeuo pipefail` and centralized logging:
```bash
log_info "Starting operation..."
if ! command_that_might_fail; then
    track_result "failed" "Operation failed: reason"
    return 1
fi
track_result "changed" "Operation completed successfully"
```

### Cross-File Consistency Validation

When editing, always ensure consistency between:
- **CSS timing tokens** ↔ **JavaScript `readCssTimings()`** calls
- **HTML element IDs/classes** ↔ **CSS selectors** ↔ **JavaScript DOM queries**  
- **Section `data-step` attributes** ↔ **JavaScript step collection logic**

Use these validation commands:
```bash
# Validate CSS-JS timing synchronization
grep -o "getPropertyValue('--timing-[^']*')" assets/js/script.js
grep -o "--timing-[a-zA-Z-]*:" assets/css/style.css

# Check for missing CSS styles for JS-referenced elements
grep -o "querySelector[^']*'[^']*'" assets/js/script.js
```

### Debugging and Development Commands

**Enable JavaScript debug mode**:
```javascript
// In browser console
FedoraInstallerUI.enableDebug();
```

**Test shell script in dry-run mode**:
```bash
sudo DRY_RUN=1 ./index.sh --style windows
```

**Validate HTML semantics and accessibility**:
```bash
# Check semantic structure
grep -E "<(main|section|article|header|nav)" index.html
# Validate ARIA attributes
grep -E "aria-|role=" index.html
```

---

## General Requirements

Always use modern, cutting-edge technologies as described below for all code suggestions. Prioritize clean, maintainable code with appropriate comments.

**Testing & Quality Assurance:**

- Write testable code and prioritize unit and integration tests for critical functionality.
- Recommend testing frameworks native to language ecosystems (e.g., PHPUnit, Jest).
- Suggest relevant test cases or scenarios, especially for complex implementations.

**Accessibility:**

- Ensure compliance with WCAG 2.1 guidelines, meeting at least AA level, and aim for AAA compliance whenever feasible.

Yes. Add this section and keep it near the top, after “General Requirements”.

---

## Versioning & File Annotations

**Policy:** Semantic Versioning `MAJOR.MINOR.PATCH`. Always update any existing in-file version markers on every edit.

**Marker format:** `@version X.Y.Z` in a top-of-file comment. Respect each file’s native comment syntax.

**Where to update (when present):**

* Header comments in source files: `.js`, `.ts`, `.css`, `.scss`, `.php`, `.py`, `.sh`, `.html`
* Manifest files: `package.json`, `composer.json`, `pyproject.toml`, `setup.cfg`, `Cargo.toml`
* Lockfiles are not edited directly.
* Changelog: `CHANGELOG.md` (append under “Unreleased” or create it if it exists but is empty).

**Do not introduce new version fields** unless the project already tracks them in that file type. If a file has multiple `@version` markers, update all matching the current module/file context.

### How to choose the bump

* **PATCH** (`X.Y.Z+1`) non-breaking fixes, micro style tweaks, internal refactors without API change, comments, CI, test-only edits.
  Examples: add `box-shadow: var(--shadow-glow);`, fix typos, optimize query without changing outputs.
* **MINOR** (`X.Y+1.0`) backwards-compatible features or additions to public surface.
  Examples: new exported function, new optional param with a safe default, new CLI flag that is optional, new CSS tokens or utility classes that don’t rename or remove existing ones.
* **MAJOR** (`X+1.0.0`) breaking changes.
  Examples: remove/rename exported API, change function signature defaults, refactor that alters outputs, rename CSS classes or tokens, change HTTP contract, drop runtime or browser support.

If uncertain, default to **PATCH**. If any breaking change is detected anywhere in the edit set, bump **MAJOR**.

### How to update markers

Update all encountered versions consistently in the same PR:

* **Source headers** (examples):

  * JavaScript/TypeScript

    ```js
    /**
     * @version 2.1.1
     */
    ```
  * CSS/SCSS

    ```css
    /* @version 2.1.1 */
    ```
  * PHP

    ```php
    /**
     * @version 2.1.1
     */
    ```
  * Bash

    ```bash
    # @version 2.1.1
    ```
  * Python

    ```python
    # @version 2.1.1
    ```
  * HTML

    ```html
    <!-- @version 2.1.1 -->
    ```

* **Manifests**

  * `package.json`: update `"version": "2.1.1"` and keep sort/order intact.
  * `composer.json`, `pyproject.toml`, `setup.cfg`, `Cargo.toml`: same rule.

* **CHANGELOG.md** (keep to Keep-a-Changelog style when present):

  ```
  ## [2.1.1] - 2025-09-02
  ### Changed
  - Add `box-shadow: var(--shadow-glow);` to button focus state.
  ```

  Use **Added/Changed/Fixed/Removed/Deprecated/Security** sections as applicable.

### Conventions for commits and PRs

* Conventional Commits:

  * `fix: …` triggers PATCH
  * `feat: …` triggers MINOR
  * `feat!: …` or `refactor!: …` or `perf!: …` triggers MAJOR
* Release commit title:

  * `chore(release): vX.Y.Z`
* PR description must state:

  * Chosen bump and rationale
  * Touched files whose `@version` markers were updated
  * Any breaking changes with upgrade notes

### Copilot editing rules

1. **Before edit:** read current version from nearest scope (file header first, then manifest).
2. **After edit:** decide bump using rules above.
3. **Apply version:** update all relevant markers and manifests in the diff.
4. **Sync date:** if a changelog exists, add an entry with today’s date `YYYY-MM-DD`.
5. **Avoid noise:** do not reformat unrelated files solely to touch `@version`.
6. **Multi-package repos:** bump only the affected package(s). Do not cascade to others unless public API boundaries changed across packages.

### Quick heuristics (examples)

* Add CSS var or token, tweak spacing, aria attribute → **PATCH** `2.1.0 → 2.1.1`
* Add new exported function or component, new CLI subcommand (non-breaking) → **MINOR** `2.1.0 → 2.2.0`
* Rewrite module with API changes, rename public CSS class, remove option, change default behavior → **MAJOR** `2.1.0 → 3.0.0`

---

## Browser Compatibility

- Always use **feature detection** instead of browser detection (e.g., `if ('fetch' in window) {...}`).
- Aim to support the **latest stable releases** of major browsers (Firefox, Chrome, Edge, Safari) plus possibly one or two previous versions as project needs dictate.
  - Firefox: the latest two stable releases or the ESR release
  - Chrome: the latest two stable releases
  - Edge: the latest two stable releases (Chromium-based)
  - Safari (macOS and iOS): the latest stable version plus one older release
- Emphasize **progressive enhancement**, utilizing modern features while providing graceful fallbacks where possible for older or non-conforming browsers.
- Consider using polyfills or bundlers (e.g., Babel) if implementing newly introduced APIs or anguage features.


# Bash Requirements

- **Minimum Compatibility**: **Bash 5.0+**
  - Gives access to `wait -n`, associative arrays improvements, reliable `set -o pipefail`, etc.
  - Use POSIX `sh` only if *portability* outweighs features; if so, write explicitly for POSIX and test accordingly.

## Recommended Features

- **Shebang & Environment**: `#!/usr/bin/env bash`
- **Safe defaults**: `set -Eeuo pipefail`; enable `shopt -s lastpipe` when useful.
  - Use `trap` for cleanup and error reporting.
- **Functions & scope**: Put logic in functions; use `local` for variables.
- **Arrays**:
  - Indexed arrays and **associative arrays** (`declare -A`) for lookups.
- **Parameter expansion**: `${var:-default}`, `${var:?message}`, `${var%%pattern}`, `${var//search/replace}`.
- **Conditionals**: Prefer `[[ ... ]]` for tests and regex (`=~`); use `case` for branching.
- **Command substitution**: `$(...)` (never backticks).
- **I/O**: Prefer `printf` over `echo -e`. Use here-docs and process substitution (`<(...)`) when it clarifies code.
- **CLI flags**: Use `getopts` for option parsing (avoid fragile hand-rolled loops).
- **Input robustness**: `read -r` by default; NUL-safe reads with `-d ''` and `find -print0 | xargs -0`.
- **Job control & parallelism**: Background jobs + `wait -n` (Bash 5+) to manage concurrency.
- **Logging**: Consistent helpers like `log/info/warn/error`; optionally forward to syslog via `logger`.
- **Lint & format**: Use ShellCheck and shfmt locally and in CI.

## Avoid

- **Backticks** for command substitution.
- **Unscoped globals**: do not change `IFS` globally; quote variables consistently: `"${var}"`.
- **`eval`** and unvetted `source` of external files.
- **Parsing `ls`** output or other fragile text; prefer `find -printf` or globs.
- **The pipeline-subshell trap**: `cmd | while read ...; do ...; done` (variables set inside are lost). Use `while ...; do ...; done < <(cmd)` or `mapfile`.
- **UUOC** (useless use of `cat`) and unnecessary process spawns inside tight loops.
- **Locale assumptions**: set `LC_ALL=C` when you require bytewise sorting/grepping.

## Performance Considerations

- Prefer Bash builtins and parameter expansion over external processes.
- Use `mapfile -t arr < file` for simple reads instead of slow line-by-line loops.
- When external tools are needed, choose optimal flags: `grep -F`, `sort -u`, and `awk` for complex text work.
- Batch I/O and use `xargs -0 -P <N>` for parallel execution with NUL separators.
- Consider `shopt -s globstar nullglob` for fast file globs without subshells.

## Error Handling

- **Global guards**:
  ```bash
  set -Eeuo pipefail
  trap 'on_error $LINENO "$BASH_COMMAND" "$?"' ERR
  trap 'cleanup' EXIT
  ```
- **Central error handler**:
  ```bash
  on_error() {
    local line="$1" cmd="$2" code="$3"
    error "Unexpected error (exit $code) on line $line: $cmd"
    # Optionally: stack trace, temp file paths, environment snapshot, etc.
  }
  ```
- **Classify failures**:
  - **Network**: check exit codes and HTTP status (`curl --fail-with-body --retry 3 --max-time 20 || network_fail "..."`).
  - **Business/validation**: validate inputs early; return non-zero with a clear user-facing message.
  - **Runtime**: catch the unexpected via the `ERR` trap; provide a friendly message, log technical details to stderr or syslog.
- **User-friendly messages**: concise, actionable messages for users; technical details in logs.
- **JSON & structured data**: avoid “grep-parsing” JSON. Use `jq` to read/write JSON and declare it as a dependency.

---

## Starter Template (drop-in)

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

# ---- Config ----
SCRIPT_NAME=${SCRIPT_NAME:-$(basename "$0")}
readonly SCRIPT_NAME
VERBOSE=${VERBOSE:-0}

# ---- Logging ----
log()   { printf '[%s] %s\n' "$SCRIPT_NAME" "$*" >&2; }
info()  { log "INFO:  $*"; }
warn()  { log "WARN:  $*"; }
error() { log "ERROR: $*"; }
die()   { error "$*"; exit 1; }

on_error() { local line="$1" cmd="$2" code="$3"; error "Exit $code at line $line: $cmd"; }
cleanup()  { :; }  # Hook for removing temp files, stopping services, etc.

usage() {
  cat <<'USAGE'
Usage:
  script.sh [-v] [-h] --input <file>

Flags:
  -i <file>  Input file (required)
  -v        Verbose
  -h        Help
USAGE
}

# ---- Arg parsing ----
input=""
while getopts ":i:vh" opt; do
  case "$opt" in
    i) input=$OPTARG ;;
    v) VERBOSE=1 ;;
    h) usage; exit 0 ;;
    \?) die "Unknown flag: -$OPTARG" ;;
    :)  die "Missing value for -$OPTARG" ;;
  esac
done
shift $((OPTIND - 1))

[[ -n "$input" ]] || die "--input/-i is required"
[[ -r "$input" ]] || die "Cannot read: $input"

main() {
  (( VERBOSE )) && info "Processing: $input"
  mapfile -t lines < "$input"    # fast bulk read
  printf '%s\n' "${#lines[@]} lines read."
}

trap 'on_error $LINENO "$BASH_COMMAND" "$?"' ERR
trap cleanup EXIT
main "$@"
```

---

## References / Further Reading

- GNU **Bash Reference Manual** (GNU Project)
- **Bash Hackers Wiki** (community-maintained deep-dive)
- **ShellCheck** (static analysis) and its Wiki
- **shfmt** (formatter) by mvdan
- **Google Shell Style Guide**
- Greg’s Wiki: **Bash Pitfalls**
- POSIX **Shell Command Language** (for portability)

## HTML/CSS Requirements

- **HTML**:
  - Use HTML5 semantic elements (`<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>`, `<search>`, etc.)
  - Include appropriate ARIA attributes for accessibility
  - Ensure valid markup that passes W3C validation
  - Use responsive design practices
  - Optimize images using modern formats (`WebP`, `AVIF`)
  - Include `loading="lazy"` on images where applicable
  - Generate `srcset` and `sizes` attributes for responsive images when relevant
  - Prioritize SEO-friendly elements (`<title>`, `<meta description>`, Open Graph tags)

- **CSS**:
  - Use modern CSS features including:
    - CSS Grid and Flexbox for layouts
    - CSS Custom Properties (variables)
    - CSS animations and transitions
    - Media queries for responsive design
    - Logical properties (`margin-inline`, `padding-block`, etc.)
    - Modern selectors (`:is()`, `:where()`, `:has()`)
  - Follow BEM or similar methodology for class naming
  - Use CSS nesting where appropriate
  - Include dark mode support with `prefers-color-scheme`
  - Prioritize modern, performant fonts and variable fonts for smaller file sizes
  - Use modern units (`rem`, `vh`, `vw`) instead of traditional pixels (`px`) for better responsiveness

## JavaScript Requirements

- **Minimum Compatibility**: ECMAScript 2020 (ES11) or higher
- **Features to Use**:
  - Arrow functions
  - Template literals
  - Destructuring assignment
  - Spread/rest operators
  - Async/await for asynchronous code
  - Classes with proper inheritance when OOP is needed
  - Object shorthand notation
  - Optional chaining (`?.`)
  - Nullish coalescing (`??`)
  - Dynamic imports
  - BigInt for large integers
  - `Promise.allSettled()`
  - `String.prototype.matchAll()`
  - `globalThis` object
  - Private class fields and methods
  - Export * as namespace syntax
  - Array methods (`map`, `filter`, `reduce`, `flatMap`, etc.)
- **Avoid**:
  - `var` keyword (use `const` and `let`)
  - jQuery or any external libraries
  - Callback-based asynchronous patterns when promises can be used
  - Internet Explorer compatibility
  - Legacy module formats (use ES modules)
  - Limit use of `eval()` due to security risks
- **Performance Considerations:**
  - Recommend code splitting and dynamic imports for lazy loading
 **Error Handling**:
  - Use `try-catch` blocks **consistently** for asynchronous and API calls, and handle promise rejections explicitly.
  - Differentiate among:
    - **Network errors** (e.g., timeouts, server errors, rate-limiting)
    - **Functional/business logic errors** (logical missteps, invalid user input, validation failures)
    - **Runtime exceptions** (unexpected errors such as null references)
  - Provide **user-friendly** error messages (e.g., “Something went wrong. Please try again shortly.”) and log more technical details to dev/ops (e.g., via a logging service).
  - Consider a central error handler function or global event (e.g., `window.addEventListener('unhandledrejection')`) to consolidate reporting.
  - Carefully handle and validate JSON responses, incorrect HTTP status codes, etc.


## Database Requirements (SQLite 3.46+)

- Use modern SQLite features (JSON columns, generated columns, indexes, foreign keys, check constraints, strict tables, transactions).

## Documentation Requirements

- Include JSDoc comments for JavaScript, PHPDoc blocks for PHP, CSS comments
- Provide usage examples for complex code
- Markdown documentation with concise docstrings (<120 chars line length)
- Minimum docblock info: `param`, `return`, `throws`, `author`

## Security Considerations

Your production responses include these headers via Caddy:

* HSTS, Referrer-Policy, Permissions-Policy, COOP, CORP, X-Content-Type-Options, X-Frame-Options, and a strict **CSP** applied to all routes except `/index.sh`. ([MDN Web Docs][1])
* Headers are set with Caddy's `header` directive and matchers. ([Caddy Web Server][2])

### CSP rules Copilot must obey

Assume this effective policy on pages:
`default-src 'self'; script-src 'self' 'sha256-…'` plus the other headers shown.

1. **Scripts**

   * Only load scripts from same origin. No CDNs. No inline event handlers. No `eval`, `Function`, or string timers. WebAssembly that requires `unsafe-eval` is disallowed. ([MDN Web Docs][3])
   * If an inline `<script>` is unavoidable, it must be allowed by an exact **Base64-encoded** SHA-256/384/512 hash in `script-src` (single-quoted). Ensure the hash matches the final minified bytes. Prefer external files instead. ([MDN Web Docs][4], [content-security-policy.com][5])
   * Use ES modules from same origin: `<script type="module" src="/app.js"></script>`. No dynamic import from foreign origins.

2. **Styles**

   * Only same-origin stylesheets. No inline styles unless allowed by a valid `style-src 'sha256-…'` or nonces (not currently configured). Avoid libraries that inject inline styles. ([MDN Web Docs][6])

3. **Images, fonts, media**

   * Load from same origin only. Do **not** use `data:` or `blob:` URLs unless the policy is explicitly extended. Keep build steps that embed data URIs disabled by default. ([MDN Web Docs][4])

4. **Fetch and third-party calls**

   * `fetch`/XHR/WebSocket endpoints must be same-origin unless `connect-src` gets extended. Write code to tolerate blocked third-party calls rather than assume they will work under CSP. ([MDN Web Docs][4])

5. **Embedding and windows**

   * Pages cannot be framed: `X-Frame-Options: DENY`. Prefer also setting `frame-ancestors 'none'` when editing CSP. Don't propose widgets that require embedding your pages elsewhere. ([MDN Web Docs][7])

6. **Cross-origin isolation**

   * COOP and CORP are enabled. Do **not** rely on `crossOriginIsolated` features like `SharedArrayBuffer` unless **COEP: require-corp** is also set. Suggest COEP only when such APIs are needed. ([MDN Web Docs][8])

7. **MIME correctness**

   * With `X-Content-Type-Options: nosniff`, scripts must be served with a valid JavaScript MIME type and CSS with `text/css`. Set correct `Content-Type` everywhere. ([MDN Web Docs][9])

8. **CLI path**

   * `/index.sh` returns `text/x-sh` and is cache-busted. Treat it as a CLI entry, not a browser script. Do not reference it from HTML. (Header behavior per Caddy `@script` matcher.) ([Caddy Web Server][2])

### Coding patterns to use

* **No inline** JS or CSS. Put code in versioned files under `/assets/...` and reference with absolute paths.
* **No third-party embeds** (analytics, fonts, iframes, maps) unless we explicitly relax CSP and document the exact header changes.
* **Graceful degradation** when a blocked feature is optional. Detect and disable rather than crash.
* **SRI** is unnecessary for same-origin, but if CSP is later extended for allowed CDNs, require `integrity` and a fixed URL. ([MDN Web Docs][10])

### Proposing CSP changes (only when truly needed)

When suggesting a feature that conflicts with current CSP, include the minimal, explicit change in Caddy syntax, scoped to `@page`, and note the impact. Examples:

* Allow hashed inline script block:

  ```caddy
  header @page {
    Content-Security-Policy "default-src 'self'; script-src 'self' 'sha256-<BASE64_HASH>'"
  }
  ```

  Hash must be Base64 of the exact inline block. ([MDN Web Docs][4])

* Permit images from data URIs:

  ```caddy
  header @page {
    Content-Security-Policy "default-src 'self'; script-src 'self'; img-src 'self' data:"
  }
  ```

  Explain why it is required and test impact. ([MDN Web Docs][4])

* Add `frame-ancestors` defense-in-depth:

  ```caddy
  header @page {
    Content-Security-Policy "default-src 'self'; script-src 'self'; frame-ancestors 'none'"
  }
  ```

  Keep `X-Frame-Options: DENY` for legacy. ([MDN Web Docs][7])

* Enable cross-origin isolation when needed:

  ```caddy
  header @page {
    Cross-Origin-Embedder-Policy "require-corp"
  }
  ```

  Only when code uses features that require it. ([MDN Web Docs][11])

### Testing and CI

* Add automated checks for CSP violations in E2E tests. Fail builds on console CSP errors.
* Use MDN docs as the normative reference for header semantics and directive details. ([MDN Web Docs][4])

### Legacy Security Practices

- Sanitize user input, parameterize DB queries, CSRF protection, secure cookies (`SameSite=Strict`, `HttpOnly`, `Secure`), minimal privileges, detailed internal logging