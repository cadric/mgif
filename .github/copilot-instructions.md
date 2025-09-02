## Project Overview

**mgif** is a minimal Fedora GNOME installer website with an accompanying shell script. The project demonstrates progressive web design patterns with a step-by-step installation guide.

### Architecture Components

* **Frontend**: Single-page application with scroll-based section navigation (`index.html`, `assets/`)
* **Backend**: Idempotent bash installation script served as executable (`index.sh`)
* **Styling**: Modern CSS with custom properties system and defensive patterns (`assets/css/style.css`)
* **Interactions**: ES2020+ JavaScript with IIFE namespace and CSS timing integration (`assets/js/script.js`)

### Key Design Patterns

* **CSS-JS Synchronization**: JavaScript reads timing values from CSS custom properties via `readCssTimings()` with caching and invalidation
* **Defensive Programming**: IIFE namespace, localStorage debug persistence, idempotent initialization, minimal public API exposure
* **Progressive Enhancement**: Feature detection, reduced-motion support, graceful degradation
* **Scroll-Based Navigation**: Section progression with History API integration and deep-linking support

---

## General Requirements

* Always use modern, clean, maintainable code with appropriate comments.
* Prioritize testable code with unit/integration tests for critical functionality.
* Follow WCAG 2.1 AA accessibility, aim for AAA where possible.

---

## Versioning & File Annotations

**Policy:** Semantic Versioning `MAJOR.MINOR.PATCH`. Always update version markers in edited files and synchronize with `CHANGELOG.md`.

**Marker format:** `@version X.Y.Z` in top-of-file comment. Respect file’s comment syntax.

**Scope:**

* Source headers: `.js`, `.css`, `.scss`, `.php`, `.py`, `.sh`, `.html`
* Manifests: `package.json`, `composer.json`, `pyproject.toml`, etc.
* `CHANGELOG.md`: append entry for each touched file.

**CHANGELOG.md format:**

```
## [2.1.2] - 2025-09-02 - script.js
### Changed
- Added new utility function …
```

* Each file edit gets its own line with filename in header.
* Group multiple file edits under same version if part of one change.

**Bump rules:**

* **PATCH**: small fixes, micro CSS/HTML/JS tweaks, non-breaking changes.
* **MINOR**: new features or backwards-compatible additions.
* **MAJOR**: breaking changes, API removals, refactors that alter behavior.
* Default to PATCH if uncertain.

**Update procedure:**

1. Read current version from file header or manifest.
2. Decide bump type from change size.
3. Update version markers in all touched files.
4. Add dated entry in `CHANGELOG.md` with file name(s) and summary.
5. Do not touch unrelated files.

---

## Browser Compatibility

* Use feature detection, not browser sniffing.
* Support latest 2 stable versions of Firefox/Chrome/Edge, and latest + one prior for Safari.
* Use progressive enhancement with graceful fallbacks.
* Use polyfills/bundlers only for modern API gaps.

---

## Bash Requirements

* Target **Bash 5.0+**.
* Use `#!/usr/bin/env bash`, `set -Eeuo pipefail`.
* Wrap logic in functions, use `local` variables.
* Prefer `[[ … ]]` for conditionals, `$(…)` for subs.
* Use associative arrays, parameter expansion, `mapfile` for efficient reads.
* Use `getopts` for option parsing.
* Logging helpers: `info`, `warn`, `error`.
* Avoid fragile patterns: backticks, `eval`, parsing `ls`, pipeline subshell trap.
* Use `trap` for error/exit handling with central `on_error`.

---

## HTML/CSS Requirements

* Use semantic HTML5, valid markup, ARIA attributes.
* Responsive design, lazy-loading images, responsive images with `srcset`.
* Optimize images (`WebP`, `AVIF`).
* CSS: use Grid/Flexbox, variables, logical properties, prefers-color-scheme.
* Naming: BEM or equivalent.
* Include dark mode.
* Modern units: `rem`, `vh`, `vw`.

---

## JavaScript Requirements

* Target ES2020+.
* Use arrow functions, template literals, destructuring, async/await, classes.
* Use optional chaining, nullish coalescing, dynamic imports.
* Avoid: `var`, jQuery, callback-based async, IE support, legacy modules.
* Error handling: always `try/catch` async code, handle network/logic/runtime separately.
* Central error handler and `window.onunhandledrejection`.
* Split code with dynamic imports for performance.

---

## Database Requirements

* Use SQLite 3.46+ features: JSON, generated columns, strict tables, FKs, transactions.

---

## Documentation Requirements

* Use JSDoc, PHPDoc, CSS comments.
* Provide usage examples for complex code.
* Keep docstrings <120 chars/line.
* Always include `@param`, `@return`, `@throws`, `@author`.

---

## Security Considerations

* Follow strict CSP: `default-src 'self'; script-src 'self' 'sha256-…'`.
* No inline JS/CSS unless hash is added.
* Only same-origin assets, no data/blob URLs unless policy updated.
* No third-party embeds unless headers adjusted.
* Scripts and CSS must use correct MIME types (nosniff enforced).
* X-Frame-Options: DENY, COOP/CORP enabled. Don’t assume `crossOriginIsolated` unless COEP added.
* `/index.sh` served as `text/x-sh`, cache-disabled, not referenced from HTML.
* CSP changes must be explicit, scoped, and justified.

---

## References

* GNU Bash Reference Manual
* Bash Hackers Wiki
* ShellCheck + Wiki
* shfmt (mvdan)
* Google Shell Style Guide
* Greg’s Wiki: Bash Pitfalls
* POSIX Shell Command Language
* MDN Web Docs (CSP, headers, HTML, JS, CSS)