# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.1] - 2025-09-02

### Fixed
- Skip link now properly visible on focus (removed conflicting sr-only class)
- Removed duplicate `.hidden` CSS rules to reduce file size
- No-js class removal now happens only after successful JavaScript initialization
- Removed non-functional http-equiv meta headers that don't set real headers

### Added
- Explicit security warning section about script safety with link to GitHub source
- Enhanced video retry functionality with visual feedback and pulse animation
- `aria-current="step"` support for collected steps navigation
- Focus management on section transitions (auto-focuses step headers)
- `rel="preconnect"` for video host to reduce latency
- Browser compatibility documentation in CSS header (Chromium ≥84, Firefox ≥90, Safari ≥14.1)
- `.sr-only:focus` override for proper accessibility
- Enhanced error handling for video play failures with retry UX

### Changed
- Consolidated backdrop blur utilities using CSS custom properties for better maintainability
- Improved collected steps ARIA state management
- Enhanced progressive enhancement patterns
- Updated debug console version display

### Security
- Added prominent warning about never running unreviewed scripts
- Maintained SHA-512 hash verification instructions
- Added direct link to GitHub repository for source code review

## [2.1.0] - 2025-09-02

### Added
- New CSS timing tokens: `--timing-transition`, `--timing-quick`, `--timing-highlight`, `--timing-copy-feedback`, `--timing-toast-duration`
- Video control styles: `#play-pause-btn`, `.play-icon`, `.pause-icon`, `.hidden` utility class
- Toast notification system with `.toast`, `.toast-error`, `.toast-success` classes
- Complete backdrop-filter support for modern browsers
- Progressive enhancement patterns with reduced-motion support

### Fixed
- Hero background gradient syntax for proper grid pattern
- Cross-browser compatibility for all timing animations
- Missing CSS styles for JavaScript-referenced elements

### Changed
- Enhanced video controls with hover and focus states
- Improved accessibility compliance for interactive elements
- Optimized CSS organization with 20 structured sections

## [2.0.0] - Previous Release
- Initial modern CSS architecture with custom properties
- Dark theme implementation
- Responsive design system
- Modern CSS features (Grid, Flexbox, Custom Properties)
