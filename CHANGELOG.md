# CHANGELOG

All notable changes to this project will be documented in this file.
This format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

## [2.1.4] - 2025-09-03 - style.css, script.js, index.html
### Changed
- Updated browser compatibility requirements to Chrome ≥113, Firefox ≥117, Safari ≥16.5 for CSS nesting support
- Removed inline style from HTML to comply with Content Security Policy (CSP)
- Added CSS class `.warning-section` for security warning styling

* Pending changes not yet released

---

## [2.1.3] - 2025-09-02 - style.css
### Fixed
- Fixed skip link visibility issue caused by global CSS reset overriding padding
- Added !important declarations to skip link padding, margin, background, and color
- Added font-size, font-weight, line-height, and white-space properties for better presentation

---

## [2.1.3] - 2025-09-02 - script.js
### Changed
- Added throttle logic to cursor arrow animation to stop after 2 seconds of mouse inactivity
- Added mouseInactivityTimeoutId and mouseInactivityDelay fields for better CPU performance
- Updated mousemove handler to clear/set inactivity timeout and track last movement time

---

## [2.1.3] - 2025-09-02 - CHANGELOG.md
### Changed
- Restructured CHANGELOG format to comply with instructions: each file edit gets its own version entry
- Separated previously grouped file entries into individual version headers per file

---

## [2.1.3] - 2025-09-02 - index.html
### Fixed
- Added missing hero-scroll-target button element for JavaScript scroll functionality
- Changed video codec from "hevc" to "hvc1" for RFC 6381 compliance and better browser support

## [2.1.2] - 2025-09-02 - assets/css/style.css
### Added
- Dynamic header spacing system with `--progress-offset` CSS variable
- Automatic content padding adjustment based on actual header height

### Fixed
- Hero section content no longer hidden behind fixed progress header
- Section content properly spaced below dynamic header
- Layout adapts automatically to header height changes on resize

### Changed
- Hero section now uses dynamic padding based on header height
- Section containers adjusted to account for variable header size
- Improved responsive behavior for different screen sizes and header configurations

## [2.1.2] - 2025-09-02 - assets/js/script.js
### Added
- `updateProgressOffset()` function for responsive header height calculation
- ResizeObserver integration to watch for header size changes

### Changed
- Enhanced dynamic header spacing system integration
- Improved responsive behavior for different screen sizes

## [2.1.1] - 2025-09-02 - index.html
### Fixed
- Removed non-functional http-equiv meta headers that don't set real headers

### Added
- Explicit security warning section about script safety with link to GitHub source
- `rel="preconnect"` for video host to reduce latency

### Security
- Added prominent warning about never running unreviewed scripts
- Maintained SHA-512 hash verification instructions
- Added direct link to GitHub repository for source code review

## [2.1.1] - 2025-09-02 - assets/css/style.css
### Fixed
- Skip link now properly visible on focus (removed conflicting sr-only class)
- Removed duplicate `.hidden` CSS rules to reduce file size

### Added
- Browser compatibility documentation in CSS header (Chromium ≥84, Firefox ≥90, Safari ≥14.1)
- `.sr-only:focus` override for proper accessibility

### Changed
- Consolidated backdrop blur utilities using CSS custom properties for better maintainability

## [2.1.1] - 2025-09-02 - assets/js/script.js
### Fixed
- No-js class removal now happens only after successful JavaScript initialization

### Added
- Enhanced video retry functionality with visual feedback and pulse animation
- `aria-current="step"` support for collected steps navigation
- Focus management on section transitions (auto-focuses step headers)
- Enhanced error handling for video play failures with retry UX

### Changed
- Improved collected steps ARIA state management
- Enhanced progressive enhancement patterns
- Updated debug console version display

## [2.1.0] - 2025-09-02 - assets/css/style.css
### Added
- New CSS timing tokens: `--timing-transition`, `--timing-quick`, `--timing-highlight`, `--timing-copy-feedback`, `--timing-toast-duration`
- Video control styles: `#play-pause-btn`, `.play-icon`, `.pause-icon`, `.hidden` utility class
- Toast notification system with `.toast`, `.toast-error`, `.toast-success` classes
- Complete backdrop-filter support for modern browsers

### Fixed
- Hero background gradient syntax for proper grid pattern
- Cross-browser compatibility for all timing animations
- Missing CSS styles for JavaScript-referenced elements

### Changed
- Enhanced video controls with hover and focus states
- Improved accessibility compliance for interactive elements
- Optimized CSS organization with 20 structured sections

## [2.1.0] - 2025-09-02 - assets/js/script.js
### Added
- Progressive enhancement patterns with reduced-motion support

## [2.0.0] - Previous Release - index.html
### Added
- Initial modern web application structure

## [2.0.0] - Previous Release - assets/css/style.css
### Added
- Initial modern CSS architecture with custom properties
- Dark theme implementation
- Responsive design system
- Modern CSS features (Grid, Flexbox, Custom Properties)

## [2.0.0] - Previous Release - assets/js/script.js
### Added
- Initial JavaScript functionality with IIFE namespace

---

### Changelog Rules

* Each file edit gets its own entry with filename in the version header.
* Use sections: **Added**, **Changed**, **Fixed**, **Removed**, **Deprecated**, **Security**.
* Group multiple file edits in the same release under one version header.
* Always include ISO date `YYYY-MM-DD`.
