# GitHub Copilot Instructions

## General Requirements

Always use modern, cutting-edge technologies as described below for all code suggestions. Prioritize clean, maintainable code with appropriate comments.

**Testing & Quality Assurance:**

- Write testable code and prioritize unit and integration tests for critical functionality.
- Recommend testing frameworks native to language ecosystems (e.g., PHPUnit, Jest).
- Suggest relevant test cases or scenarios, especially for complex implementations.

**Accessibility:**

- Ensure compliance with WCAG 2.1 guidelines, meeting at least AA level, and aim for AAA compliance whenever feasible.

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

- Sanitize user input, parameterize DB queries, apply CSP headers, CSRF protection, secure cookies (`SameSite=Strict`, `HttpOnly`, `Secure`), minimal privileges, detailed internal logging