# Code Review Report: Duplicates and Dead Code- ✅ **FIXED**: Dead/Unused selectors/utilities - Removed unused CSS rules
  - Removed `.feature h3` (feature cards in HTML use `<h4>` inside `.feature`)
  - Removed unused utility classes:
    - `.text-balance`
    - `.mx-auto`: 2025-08-30
Files Reviewed: `index.html`, `js/script.js`, `css/style.css`
Focus: Identify duplicated logic/markup and dead or unused code. Remove prior false claims.

## Executive Summary

- No duplicated scroll-indicator markup exists in HTML; indicators are generated in JS.
- No unused app methods found; teardown is wired to `beforeunload`.
- ✅ **FIXED**: Timing constants unified to use CSS custom properties as single source of truth.
- A few CSS selectors/utilities are currently unused; safe to prune.
- ✅ **FIXED**: Logger shadowing issue resolved - all `catch (error)` blocks renamed to `catch (err)`.

## HTML (`index.html`)

- Duplicates: None detected.
  - Scroll indicators are not hard-coded; they’re created at runtime in `js/script.js`.
  - Static JSON-LD mirrors content for SEO; that duplication is intentional. JS can regenerate JSON-LD (currently gated by `DEBUG`).
- Dead/Unused: None obvious.
- Minor consistency note: Video source is `https://ifg.sh/showcase-v1.mp4` while JS fallback link points to `https://ifg.sh/showcase.mp4` (version mismatch).

## JavaScript (`js/script.js`)

- Duplications
  - ✅ **FIXED**: Timing constants were split between `GLOBAL_TIMINGS` and `#timings`. Now unified to use CSS custom properties as single source of truth.

- Dead/Unused
  - None found. `destroy()` is actively wired via `#wireUpDestroy()` to `beforeunload`.
  - Debug helpers (`DEBUG`, `log`, `warn`) are used and intentionally no-op when `DEBUG` is false.

- Already deduplicated/unified (no action needed)
  - Scroll indicator generation is centralized in `#generateScrollIndicators()` and `#createScrollIndicator()`.
  - Wheel/touch navigation uses a unified decision helper `#shouldNavigateByWheelOrSwipe()`.
  - JSON-LD can be generated from DOM via `#generateHowToJsonLD()` and updated by `#updateHowToJsonLD()` (currently in DEBUG).

- ✅ **FIXED**: Logger shadowing issue
  - All `catch (error)` blocks have been renamed to `catch (err)` to prevent shadowing the global `error` logger function.

## CSS (`css/style.css`)

- Duplications
  - Scrollbar styling is already consolidated via `:is(.section .container, .scrollable)` selectors. No duplication to remove.
  - Backdrop-blur utilities are implemented once and reused (`.backdrop-blur-*`).
  - Media queries are organized; there is a single `@media (max-width: 768px)` block.

- Dead/Unused selectors/utilities
  - `.feature h3` appears unused; feature cards in HTML use `<h4>` inside `.feature`.
  - Utility classes defined but not referenced in HTML/JS:
    - `.text-balance`
    - `.mx-auto`
  - Consider removing if you don’t plan to use them.

- Other observations
  - ✅ **FIXED**: Undefined custom property - Added `--timing-ease-out: cubic-bezier(0.22, 1, 0.36, 1)` to `:root` for video transitions and other smooth ease-out effects.
  - Duplicate `min-block-size` declarations using `100vh` and `100dvh` are intentional for viewport compatibility, not duplication.

## Cross-file consistency

- Timings: Prefer a single source of truth. Either expose all timing values as CSS variables and read them in JS, or keep them in JS and avoid separate copies.
- Video asset naming: Align the fallback link in JS (`showcase.mp4`) with the HTML source (`showcase-v1.mp4`).
- JSON-LD: If you want zero drift, consider enabling DOM-driven JSON-LD generation outside DEBUG (or generate at build time).

## Actionable Recommendations

1. ✅ **COMPLETED**: Centralize timings - Now using CSS custom properties as single source of truth
2. ✅ **COMPLETED**: Fix logger shadowing - All catch parameters renamed to `err`
3. ✅ **COMPLETED**: Clean up unused CSS - Removed `.feature h3`, `.text-balance`, `.mx-auto`
4. ✅ **COMPLETED**: Define `--timing-ease-out` - Added cubic-bezier ease-out timing function
5. ✅ **COMPLETED**: Align video URLs (now using `showcase-v1.mp4` consistently).
6. Optional: Make DOM-generated JSON-LD the default in production to avoid manual drift, or generate at build time.

## Suggested Tests (lightweight)

- Navigation: hero ⇄ steps via wheel, touch, keyboard; ensure scroll areas don’t trigger page transitions prematurely.
- Collected steps: verify deduplication and navigation by clicking collected step buttons.
- Video: play/pause control states, overlay visibility, error fallback renders with link.
- JSON-LD (if enabled in prod): schema updates with correct step URLs.

## Conclusion

The codebase avoids major duplication in markup and logic. All key cleanups have been completed:
- ✅ Timing values centralized to CSS custom properties 
- ✅ Logger shadowing fixed (all catch blocks use `err` parameter)
- ✅ Video URL consistency resolved
- ✅ Unused CSS selectors/utilities removed
- ✅ Missing `--timing-ease-out` custom property added

No remaining critical issues. The optional recommendation to use DOM-generated JSON-LD in production remains for consideration. Overall, the structure is solid with good accessibility and progressive enhancement practices already in place.