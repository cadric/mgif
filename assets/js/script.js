/**
 * Fedora GNOME Installer Website - Page Transitions & Interactions
 * @author Cadric
 * @description Modern ES2020+ implementation with progressive enhancement
 * @version 2.1.7
 * @requires Chrome ≥113, Firefox ≥117, Safari ≥16.5 (for CSS nesting compatibility)
 */

(function (root) {
'use strict';

// Configuration & Debugging with localStorage fallback
const DEBUG = (() => {
  try {
    const qs = new URLSearchParams(globalThis.location.search);
    if (qs.has('debug')) return true;
    return localStorage.getItem('debug') === '1';
  } catch { return false; }
})();

const log = (...args) => DEBUG && console.log(...args);
const warn = (...args) => DEBUG && console.warn(...args);
const error = console.error.bind(console);

    if (DEBUG) {
        console.log('%c🐛 Debug Mode Enabled', 'background: #3b82f6; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;');
        console.log('%c📦 Fedora Installer v2.1.5 - Enhanced Build', 'background: #10b981; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.9em;');
        console.log('Features: IIFE namespace, CSS caching, localStorage debug, idempotent init, electric pulses');
    }// Cached CSS timings with invalidation
let __timingsCache = null;
let __cacheKey = '';

/**
 * Generate cache key based on viewport and motion preferences
 */
const __timingsKey = () => {
    const motionKey = (matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) ? 'pr' : 'pn';
    const viewportKey = (innerWidth || 0);
    return `${motionKey}:${viewportKey}`;
};

/**
 * Read CSS timing custom properties and convert to milliseconds (with caching)
 * @returns {Object} Timing constants in milliseconds
 */
const readCssTimings = () => {
    const key = __timingsKey();
    if (__timingsCache && __cacheKey === key) {
        return __timingsCache;
    }
    
    try {
        const styles = getComputedStyle(document.documentElement);
        const toMs = (v) => {
            if (!v) return 0;
            return v.endsWith('ms') ? parseFloat(v) : parseFloat(v) * 1000;
        };
        
        __timingsCache = {
            fast: toMs(styles.getPropertyValue('--animation-duration-fast').trim() || '0.3s'),
            base: toMs(styles.getPropertyValue('--animation-duration-base').trim() || '0.5s'),
            slow: toMs(styles.getPropertyValue('--animation-duration-slow').trim() || '0.8s'),
            entrance: toMs(styles.getPropertyValue('--animation-duration-entrance').trim() || '1s'),
            transition: toMs(styles.getPropertyValue('--timing-transition').trim() || '0.3s'),
            quick: toMs(styles.getPropertyValue('--timing-quick').trim() || '0.1s'),
            highlight: toMs(styles.getPropertyValue('--timing-highlight').trim() || '1s'),
            copyFeedback: toMs(styles.getPropertyValue('--timing-copy-feedback').trim() || '1.5s'),
            toastDuration: toMs(styles.getPropertyValue('--timing-toast-duration').trim() || '5s')
        };
        __cacheKey = key;
        return __timingsCache;
    } catch (err) {
        console.error('Failed to read CSS timings, using fallbacks:', err);
        __timingsCache = {
            fast: 300,
            base: 500,
            slow: 800,
            entrance: 1000,
            transition: 300,
            quick: 100,
            highlight: 1000,
            copyFeedback: 1500,
            toastDuration: 5000
        };
        __cacheKey = key;
        return __timingsCache;
    }
};

// Cache invalidation setup
(function() {
    const mql = (typeof matchMedia === 'function') && matchMedia('(prefers-reduced-motion: reduce)');
    if (mql && mql.addEventListener) {
        mql.addEventListener('change', () => { __timingsCache = null; });
    }
    addEventListener('resize', () => { __timingsCache = null; });
})();

/**
 * Main application class for handling website interactions
 */
class FedoraInstallerUI {
    // Private fields
    #progressEl;
    #collectedSteps;
    #sections;
    #hero;
    #currentSectionIndex = -1;
    #isTransitioning = false;
    #touchStartY = 0;
    #touchStartX = 0;
    
    // Mouse cursor arrow fields
    #cursorCanvas;
    #cursorCtx;
    #cursorTarget;
    #mousePosition = { x: null, y: null };
    #cursorAnimationId = null;
    #isCursorActive = false;
    #lastMouseMoveTime = 0;
    #mouseInactivityTimeoutId = null;
    #mouseInactivityDelay = 2000; // Stop animation after 2 seconds of no movement
    
    // Accessibility and motion preferences
    #prefersReducedMotion = false;
    #timings = null;
    
    // Step titles mapping
    #stepTitles = {
        'intro': 'Introduction',
        '1': 'Download Fedora Everything',
        '2': 'Login and Switch to Root',
        '3': 'Run the Installation Script',
        '4': 'Answer Configuration Questions',
        '5': 'Enjoy Your New Desktop'
    };

    // Short titles for small screens
    #stepTitlesShort = {
        'intro': 'Introduction',
        '1': 'Download',
        '2': 'Login',
        '3': 'Run',
        '4': 'Questions',
        '5': 'Enjoy'
    };

    constructor() {
        this.#prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.#timings = readCssTimings();
        
        this.#initializeElements();
        this.#generateScrollIndicators();
        this.#setupPageTransitions();
        this.#initializeCursorArrow();
        this.#bindEvents();
        this.#initializeCopyButtons();
        this.#initialize();
        this.#setupHistoryAPI();
        this.#wireUpDestroy();
    }

    /**
     * Initialize DOM elements with error handling
     */
    #initializeElements() {
        try {
            this.#progressEl = document.getElementById('progress');
            this.#collectedSteps = document.querySelector('.collected-steps');
            this.#sections = document.querySelectorAll('.section[data-step]');
            this.#hero = document.querySelector('.hero');

            if (!this.#progressEl || !this.#collectedSteps || !this.#hero) {
                throw new Error('Required DOM elements not found');
            }

            this.#sections.forEach(section => {
                section.classList.remove('visible', 'active');
            });

        } catch (err) {
            error('Failed to initialize DOM elements:', err);
            throw err;
        }
    }

    /**
     * Initialize copy buttons for code blocks
     */
    #initializeCopyButtons() {
        try {
            document.querySelectorAll('.code-block').forEach(block => {
                const existingBtn = block.nextElementSibling?.classList.contains('copy');
                if (existingBtn) return;

                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'copy copy-btn';
                btn.setAttribute('aria-label', 'Copy code to clipboard');
                btn.setAttribute('title', 'Copy code');
                
                btn.innerHTML = `
                    <svg class="copy-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                    </svg>
                    <span class="copy-text">Copy</span>
                `;
                
                block.insertAdjacentElement('afterend', btn);
                log('Copy button injected for code block');
            });
        } catch (err) {
            error('Failed to initialize copy buttons:', err);
        }
    }

    /**
     * Setup page transition system
     */
    #setupPageTransitions() {
        this.#hero?.classList.add('visible');
        this.#currentSectionIndex = -1;
        this.#updateProgressBar();
    }

    /**
     * Initialize cursor arrow system for Hero section
     */
    #initializeCursorArrow() {
        try {
            this.#cursorCanvas = document.getElementById('hero-cursor-overlay');
            this.#cursorTarget = document.getElementById('hero-scroll-target');
            
            if (!this.#cursorCanvas || !this.#cursorTarget) {
                warn('Cursor arrow elements not found - skipping initialization');
                return;
            }

            this.#cursorCtx = this.#cursorCanvas.getContext('2d');
            this.#updateCanvasSize();

            globalThis.addEventListener('resize', () => this.#updateCanvasSize());

            document.addEventListener('mousemove', (e) => {
                if (this.#currentSectionIndex === -1) {
                    this.#mousePosition.x = e.clientX;
                    this.#mousePosition.y = e.clientY;
                    this.#lastMouseMoveTime = performance.now();
                    
                    // Clear any existing inactivity timeout
                    if (this.#mouseInactivityTimeoutId) {
                        clearTimeout(this.#mouseInactivityTimeoutId);
                        this.#mouseInactivityTimeoutId = null;
                    }
                    
                    if (!this.#isCursorActive) {
                        this.#startCursorAnimation();
                    }
                    
                    // Set up new inactivity timeout to stop animation
                    this.#mouseInactivityTimeoutId = setTimeout(() => {
                        this.#stopCursorAnimation();
                        this.#mouseInactivityTimeoutId = null;
                    }, this.#mouseInactivityDelay);
                }
            });

            document.addEventListener('mouseleave', () => this.#stopCursorAnimation());
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    this.#stopCursorAnimation();
                }
            });
            
        } catch (err) {
            error('Failed to initialize cursor arrow:', err);
        }
    }

    /**
     * Bind all event listeners
     */
    #bindEvents() {
        document.querySelectorAll('.scroll-indicator').forEach(indicator => {
            indicator.addEventListener('click', (e) => {
                e.preventDefault();
                this.#goToNextSection();
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.target.matches('input, textarea, select, [contenteditable="true"]')) {
                return;
            }
            
            const keyActions = {
                'ArrowDown': () => this.#goToNextSection(),
                ' ': () => this.#goToNextSection(),
                'ArrowUp': () => this.#goToPreviousSection(),
                'Home': () => this.#goToSection(-1),
                'End': () => this.#goToSection(this.#sections.length - 1)
            };

            if (keyActions[e.key]) {
                e.preventDefault();
                keyActions[e.key]();
            }
        });

        this.#setupTouchHandlers(this.#hero);
        this.#sections.forEach(section => {
            this.#setupTouchHandlers(section);
        });

        document.addEventListener('wheel', (e) => {
            if (this.#isTransitioning) return;
            
            if (!this.#shouldNavigateByWheelOrSwipe(e.deltaY, e.target)) {
                return;
            }
            
            e.preventDefault();
            
            if (e.deltaY > 0) {
                this.#goToNextSection();
            } else {
                this.#goToPreviousSection();
            }
        }, { passive: false });

        document.addEventListener('click', (e) => {
            const stepElement = e.target.closest('.collected-step');
            if (stepElement) {
                const stepIndex = stepElement.dataset.stepIndex;
                const parsedIndex = Number.isInteger(+stepIndex) ? +stepIndex : null;
                
                if (parsedIndex !== null && parsedIndex >= -1 && parsedIndex < this.#sections.length) {
                    this.#goToSection(parsedIndex);
                }
            }
        });
        
        globalThis.addEventListener('popstate', () => {
            this.#handleHistoryNavigation();
        });
    }

    /**
     * Setup touch event handlers for an element
     */
    #setupTouchHandlers(element) {
        element.addEventListener('touchstart', (e) => {
            if (!e.touches?.length) return;
            this.#touchStartY = e.touches[0].clientY;
            this.#touchStartX = e.touches[0].clientX;
        }, { passive: true });

        if (element === this.#hero) {
            element.addEventListener('touchmove', (e) => {
                if (this.#isFromScrollableElement(e.target)) return;
                e.preventDefault();
            }, { passive: false });
        }

        element.addEventListener('touchend', (e) => {
            this.#handleTouchEnd(e);
        }, { passive: true });
    }

    /**
     * Handle touch end events with scroll awareness
     */
    #handleTouchEnd(e) {
        if (this.#isTransitioning || !e.changedTouches?.length) return;

        const touchEndY = e.changedTouches[0].clientY;
        const touchEndX = e.changedTouches[0].clientX;
        const deltaY = this.#touchStartY - touchEndY;
        const deltaX = this.#touchStartX - touchEndX;

        const minDistance = 24;
        const absDeltaY = Math.abs(deltaY);
        const absDeltaX = Math.abs(deltaX);
        
        if (absDeltaY < minDistance || absDeltaX > absDeltaY) {
            return;
        }

        if (!this.#shouldNavigateByWheelOrSwipe(deltaY > 0 ? 1 : -1, e.target)) {
            return;
        }

        if (deltaY > 0) {
            this.#goToNextSection();
        } else {
            this.#goToPreviousSection();
        }
    }

    /**
     * Check if event originated from a scrollable element
     */
    #isFromScrollableElement(target) {
        return target?.closest('pre, code, textarea, .scroll, [data-scrollable="true"], .video-showcase');
    }

    /**
     * Check if we should allow scrolling within the current section
     */
    #shouldAllowSectionScroll(e) {
        if (this.#currentSectionIndex === -1) {
            return false;
        }

        const currentSection = this.#sections[this.#currentSectionIndex];
        if (!currentSection?.classList.contains('visible')) {
            return false;
        }

        const container = currentSection.querySelector('.container');
        if (!container) {
            return false;
        }

        const scrollTop = container.scrollTop;
        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;
        
        if (scrollHeight <= clientHeight) {
            return false;
        }

        if (e.deltaY > 0) {
            const isAtBottom = Math.abs(scrollTop + clientHeight - scrollHeight) < 1;
            return !isAtBottom;
        } else {
            const isAtTop = scrollTop < 1;
            return !isAtTop;
        }
    }

    /**
     * Unified decision logic for wheel/touch navigation vs. scrolling
     */
    #shouldNavigateByWheelOrSwipe(deltaY, originEl) {
        if (this.#currentSectionIndex === -1) return true;
        if (this.#isFromScrollableElement(originEl)) return false;
        return !this.#shouldAllowSectionScroll({ deltaY });
    }

    /**
     * Navigate to next section
     */
    #goToNextSection() {
        if (this.#isTransitioning) return;
        
        const nextIndex = this.#currentSectionIndex + 1;
        if (nextIndex < this.#sections.length) {
            this.#goToSection(nextIndex);
        }
    }

    /**
     * Navigate to previous section
     */
    #goToPreviousSection() {
        if (this.#isTransitioning) return;
        
        const prevIndex = this.#currentSectionIndex - 1;
        if (prevIndex >= -1) {
            this.#goToSection(prevIndex);
        }
    }

    /**
     * Navigate to specific section
     */
    #goToSection(sectionIndex) {
        if (this.#isTransitioning || sectionIndex === this.#currentSectionIndex) return;
        
        this.#isTransitioning = true;
        
        if (this.#currentSectionIndex === -1 && sectionIndex !== -1) {
            this.#stopCursorAnimation();
        }
        
        if (this.#currentSectionIndex === -1) {
            this.#hero.classList.remove('visible');
        } else {
            const currentSection = this.#sections[this.#currentSectionIndex];
            currentSection?.classList.remove('visible', 'active');
        }

        this.#updateHistory(sectionIndex);
        this.#updateCollectedStepsAria(sectionIndex);

        setTimeout(() => {
            if (sectionIndex === -1) {
                this.#hero.classList.add('visible');
                // Focus management for hero section
                const heroTitle = document.getElementById('hero-title');
                heroTitle?.focus();
            } else {
                const targetSection = this.#sections[sectionIndex];
                if (targetSection) {
                    targetSection.classList.add('visible', 'active');
                    
                    // Focus management: move focus to step header
                    const stepHeader = targetSection.querySelector('h2');
                    if (stepHeader) {
                        stepHeader.setAttribute('tabindex', '-1');
                        stepHeader.focus();
                    }
                    
                    const stepId = targetSection.getAttribute('data-step');
                    if (stepId && this.#stepTitles[stepId]) {
                        this.#collectStep(stepId, this.#stepTitles[stepId], sectionIndex);
                    }
                }
            }
            
            this.#currentSectionIndex = sectionIndex;
            this.#updateProgressBar();
            
            setTimeout(() => {
                this.#isTransitioning = false;
            }, this.#timings.transition);
        }, this.#timings.quick);
    }

    /**
     * Render section immediately without animation
     */
    #renderSectionImmediate(sectionIndex) {
        try {
            this.#hero?.classList.remove('visible');
            this.#sections.forEach(section => {
                section.classList.remove('visible', 'active');
            });

            if (sectionIndex === -1) {
                this.#hero?.classList.add('visible');
            } else if (sectionIndex >= 0 && sectionIndex < this.#sections.length) {
                const targetSection = this.#sections[sectionIndex];
                if (targetSection) {
                    targetSection.classList.add('visible', 'active');
                    
                    const stepId = targetSection.getAttribute('data-step');
                    if (stepId && this.#stepTitles[stepId]) {
                        this.#collectStep(stepId, this.#stepTitles[stepId], sectionIndex);
                    }
                }
            }

            this.#currentSectionIndex = sectionIndex;
            this.#updateProgressBar();
            
        } catch (err) {
            error('Failed to render section immediately:', err);
        }
    }

    /**
     * Setup History API for deep linking
     */
    #setupHistoryAPI() {
        try {
            const hash = globalThis.location.hash;
            if (hash) {
                const sectionIndex = this.#getSectionIndexFromHash(hash);
                if (sectionIndex !== null && sectionIndex !== this.#currentSectionIndex) {
                    this.#renderSectionImmediate(sectionIndex);
                }
            }
        } catch (err) {
            warn('Failed to setup history API:', err);
        }
    }

    /**
     * Update browser history
     */
    #updateHistory(sectionIndex) {
        try {
            let hash = '';
            if (sectionIndex === -1) {
                hash = '';
            } else {
                const section = this.#sections[sectionIndex];
                const stepId = section?.getAttribute('data-step');
                if (stepId) {
                    hash = stepId === 'intro' ? '#intro' : `#step-${stepId}`;
                }
            }
            
            const currentHash = globalThis.location.hash;
            if (hash !== currentHash) {
                history.replaceState(null, '', hash);
            }
        } catch (err) {
            warn('Failed to update history:', err);
        }
    }

    /**
     * Handle browser back/forward navigation
     */
    #handleHistoryNavigation() {
        try {
            const hash = globalThis.location.hash;
            const sectionIndex = this.#getSectionIndexFromHash(hash);
            
            if (sectionIndex !== null && sectionIndex !== this.#currentSectionIndex) {
                this.#goToSection(sectionIndex);
            }
        } catch (err) {
            warn('Failed to handle history navigation:', err);
        }
    }

    /**
     * Get section index from URL hash
     */
    #getSectionIndexFromHash(hash) {
        if (!hash || hash === '#') return -1;
        
        if (hash === '#intro') {
            for (let i = 0; i < this.#sections.length; i++) {
                if (this.#sections[i].getAttribute('data-step') === 'intro') {
                    return i;
                }
            }
        }
        
        const stepMatch = hash.match(/^#step-(\d+)$/);
        if (stepMatch) {
            const stepNumber = stepMatch[1];
            for (let i = 0; i < this.#sections.length; i++) {
                if (this.#sections[i].getAttribute('data-step') === stepNumber) {
                    return i;
                }
            }
        }
        
        return null;
    }

    /**
     * Collect step function with enhanced error handling
     */
    #collectStep(stepId, title, sectionIndex) {
        try {
            const existingStep = this.#collectedSteps.querySelector(`[data-step-id="${stepId}"]`);
            if (existingStep) {
                this.#highlightElement(existingStep);
                return;
            }

            const stepElement = document.createElement('button');
            stepElement.className = 'collected-step';
            stepElement.setAttribute('data-step-id', stepId);
            stepElement.setAttribute('data-step-index', sectionIndex);
            stepElement.setAttribute('aria-label', `Go to ${title}`);
            
            // Use responsive titles - short on small screens, full on larger screens
            const shortTitle = this.#stepTitlesShort[stepId] || title;
            stepElement.innerHTML = `
                <span class="collected-step-title-full">${title}</span>
                <span class="collected-step-title-short">${shortTitle}</span>
            `;

            stepElement.addEventListener('click', (e) => {
                e.preventDefault();
                const index = parseInt(stepElement.dataset.stepIndex);
                if (!isNaN(index)) {
                    this.#goToSection(index);
                }
            });

            stepElement.classList.add('collected-step-entering');
            this.#collectedSteps.appendChild(stepElement);

            requestAnimationFrame(() => {
                stepElement.classList.remove('collected-step-entering');
                stepElement.classList.add('collected-step-entered');
            });

            setTimeout(() => this.#highlightElement(stepElement), this.#timings.quick);

        } catch (err) {
            error('Failed to collect step:', err);
        }
    }

    /**
     * Update aria-current attributes for collected steps
     */
    #updateCollectedStepsAria(currentSectionIndex) {
        try {
            const allSteps = this.#collectedSteps.querySelectorAll('.collected-step');
            allSteps.forEach(step => {
                const stepIndex = parseInt(step.dataset.stepIndex);
                if (stepIndex === currentSectionIndex) {
                    step.setAttribute('aria-current', 'step');
                } else {
                    step.removeAttribute('aria-current');
                }
            });
        } catch (err) {
            error('Failed to update collected steps aria attributes:', err);
        }
    }

    /**
     * Highlight element with visual feedback
     */
    #highlightElement(element) {
        try {
            element.classList.add('highlight');
            
            setTimeout(() => {
                element.classList.remove('highlight');
            }, this.#timings.highlight);
            
            element.classList.add('has-hover-effects');
            
        } catch (err) {
            error('Failed to highlight element:', err);
        }
    }

    /**
     * Update progress bar based on current section
     */
    #updateProgressBar() {
        try {
            const stepSections = Array.from(this.#sections)
                .filter(s => s.dataset.step && s.dataset.step !== 'intro');
            const totalSteps = stepSections.length;

            let currentStepNumber = 0;
            if (this.#currentSectionIndex >= 0) {
                const active = this.#sections[this.#currentSectionIndex];
                const id = active?.dataset?.step ?? null;
                if (id && id !== 'intro') {
                    const parsed = parseInt(id, 10);
                    currentStepNumber = Number.isInteger(parsed) ? parsed : 0;
                }
            }

            const progress = totalSteps > 0
                ? Math.min(100, Math.max(0, (currentStepNumber / totalSteps) * 100))
                : 0;

            if (this.#progressEl) {
                this.#progressEl.value = progress;
                this.#progressEl.setAttribute('aria-valuenow', String(Math.round(progress)));
                
                const stepText = currentStepNumber > 0 
                    ? `Step ${currentStepNumber} of ${totalSteps}`
                    : 'Getting started';
                this.#progressEl.setAttribute('aria-valuetext', stepText);
            }
        } catch (err) {
            error('Failed to update progress bar:', err);
        }
    }

    /**
     * Initialize showcase video with enhanced loading
     */
    #initializeShowcaseVideo() {
        const video = document.querySelector('.showcase-video');
        if (!video) return;

        try {
            const handleVideoLoad = () => {
                video.setAttribute('data-loaded', 'true');
                video.setAttribute('aria-busy', 'false');
                log('Showcase video loaded successfully');
            };

            if (video.readyState >= 3) {
                handleVideoLoad();
            } else {
                video.addEventListener('loadeddata', handleVideoLoad, { once: true });
                video.addEventListener('canplaythrough', handleVideoLoad, { once: true });
                video.addEventListener('loadedmetadata', () => {
                    video.setAttribute('aria-busy', 'false');
                }, { once: true });
            }

            video.addEventListener('error', (error) => {
                error('Video failed to load:', error);
                this.#handleVideoError(video);
            }, { once: true });

            this.#initializeVideoControls(video);
            this.#respectUserPreferences(video);

        } catch (err) {
            error('Failed to initialize showcase video:', err);
            this.#handleVideoError(video);
        }
    }

    /**
     * Initialize custom video controls
     */
    #initializeVideoControls(video) {
        const playPauseBtn = document.getElementById('play-pause-btn');
        const playOverlay = document.getElementById('video-play-overlay');

        if (!playPauseBtn) return;

        playPauseBtn.addEventListener('click', async () => {
            try {
                if (video.paused) {
                    await video.play();
                } else {
                    video.pause();
                }
            } catch (error) {
                console.log('Play failed:', error.name);
            }
        });

        if (playOverlay) {
            const overlayBtn = playOverlay.querySelector('.video-play-overlay-btn');
            overlayBtn?.addEventListener('click', async () => {
                try {
                    await video.play();
                    playOverlay.classList.add('hidden');
                } catch (error) {
                    console.log('Play failed:', error.name);
                    this.#handleVideoPlayError(error, video, overlayBtn);
                }
            });
        }

        video.addEventListener('play', () => {
            this.#updatePlayPauseButton(true);
            playOverlay?.classList.add('hidden');
        });
        
        video.addEventListener('pause', () => {
            this.#updatePlayPauseButton(false);
            playOverlay?.classList.remove('hidden');
        });

        this.#updatePlayPauseButton(!video.paused);
    }

    /**
     * Update play/pause button appearance
     */
    #updatePlayPauseButton(isPlaying) {
        const playPauseBtn = document.getElementById('play-pause-btn');
        if (!playPauseBtn) return;

        const playIcon = playPauseBtn.querySelector('.play-icon');
        const pauseIcon = playPauseBtn.querySelector('.pause-icon');

        if (isPlaying) {
            playIcon?.classList.add('hidden');
            pauseIcon?.classList.remove('hidden');
            playPauseBtn.setAttribute('aria-label', 'Pause video');
        } else {
            playIcon?.classList.remove('hidden');
            pauseIcon?.classList.add('hidden');
            playPauseBtn.setAttribute('aria-label', 'Play video');
        }
    }

    /**
     * Respect user preferences for motion and data usage
     */
    #respectUserPreferences(video) {
        if (this.#prefersReducedMotion) {
            video.setAttribute('preload', 'metadata');
            video.removeAttribute('autoplay');
            this.#addVideoPlayButton(video);
        }

        if (navigator.connection?.saveData) {
            video.setAttribute('preload', 'none');
            video.removeAttribute('autoplay');
            this.#addVideoPlayButton(video);
        }

        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (isIOS && video.hasAttribute('autoplay')) {
            video.removeAttribute('autoplay');
            this.#addVideoPlayButton(video);
        }
    }

    /**
     * Add a manual play button for users with data constraints
     */
    #addVideoPlayButton(video) {
        const playButton = document.createElement('button');
        playButton.className = 'video-play-button backdrop-blur-8';
        playButton.setAttribute('aria-label', 'Play installation demo video');
        
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '64');
        svg.setAttribute('height', '64');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'currentColor');
        svg.setAttribute('aria-hidden', 'true');
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M8 5v14l11-7z');
        svg.appendChild(path);
        
        const span = document.createElement('span');
        span.textContent = 'Play Installation Demo';
        
        playButton.appendChild(svg);
        playButton.appendChild(span);

        playButton.addEventListener('click', async () => {
            try {
                await video.play();
                playButton.remove();
            } catch (error) {
                error('Video play failed:', error);
                this.#handleVideoPlayError(error);
            }
        });

        const videoContainer = video.closest('.video-showcase');
        videoContainer?.appendChild(playButton);
    }

    /**
     * Handle video loading errors gracefully
     */
    #handleVideoError(video) {
        const videoContainer = video.closest('.video-showcase');
        if (!videoContainer) return;

        const fallback = document.createElement('div');
        fallback.className = 'video-fallback video-error-fallback';
        
        const content = document.createElement('div');
        content.className = 'video-fallback-content';
        
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '64');
        svg.setAttribute('height', '64');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'currentColor');
        svg.classList.add('is-muted');
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z');
        svg.appendChild(path);
        
        const title = document.createElement('h3');
        title.textContent = 'Installation Demo';
        
        const description = document.createElement('p');
        description.textContent = 'Experience the smooth, automated Fedora GNOME installation process.';
        
        const link = document.createElement('a');
        link.href = 'https://ifg.sh/assets/video/showcase-v1-h265.mp4';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'fallback-link';
        link.textContent = 'View Demo Video →';
        
        content.append(svg, title, description, link);
        fallback.appendChild(content);

        video.replaceWith(fallback);
    }

    /**
     * Handle video play errors consistently
     */
    #handleVideoPlayError(error, video = null, retryButton = null) {
        warn('Video play failed:', error.name, error.message);
        
        if (retryButton && video) {
            // Add retry functionality to the button
            this.#addRetryToVideoButton(retryButton, video);
        } else {
            showErrorToast('Failed to play video. Please try again.');
        }
    }

    /**
     * Add retry functionality to video button after play failure
     */
    #addRetryToVideoButton(button, video) {
        const originalText = button.querySelector('.play-overlay-text')?.textContent || 'Play Video';
        const textElement = button.querySelector('.play-overlay-text');
        
        if (textElement) {
            textElement.textContent = 'Retry Video';
        }
        
        button.classList.add('retry-state');
        
        // Reset after a delay
        setTimeout(() => {
            if (textElement) {
                textElement.textContent = originalText;
            }
            button.classList.remove('retry-state');
        }, 3000);
    }

    /**
     * Initialize the application
     */
    #initialize() {
        this.#updateProgressBar();
        this.#initializeShowcaseVideo();
        
        if (DEBUG) {
            this.#updateHowToJsonLD();
        }
        
        log('Fedora GNOME installer website loaded with page transitions!');
    }

    /**
     * Update canvas size to match viewport
     */
    #updateCanvasSize() {
        if (!this.#cursorCanvas) return;
        
        this.#cursorCanvas.width = globalThis.innerWidth;
        this.#cursorCanvas.height = globalThis.innerHeight;
    }

    /**
     * Start cursor arrow animation
     */
    #startCursorAnimation() {
        if (this.#isCursorActive || !this.#cursorCanvas) return;
        
        this.#isCursorActive = true;
        this.#cursorCanvas.classList.add('active');
        this.#animateCursorArrow();
    }

    /**
     * Stop cursor arrow animation
     */
    #stopCursorAnimation() {
        this.#isCursorActive = false;
        
        if (this.#cursorAnimationId) {
            cancelAnimationFrame(this.#cursorAnimationId);
            this.#cursorAnimationId = null;
        }
        
        if (this.#mouseInactivityTimeoutId) {
            clearTimeout(this.#mouseInactivityTimeoutId);
            this.#mouseInactivityTimeoutId = null;
        }
        
        if (this.#cursorCanvas) {
            this.#cursorCanvas.classList.remove('active');
            this.#clearCanvas();
        }
    }

    /**
     * Clear the cursor canvas
     */
    #clearCanvas() {
        if (this.#cursorCtx && this.#cursorCanvas) {
            this.#cursorCtx.clearRect(0, 0, this.#cursorCanvas.width, this.#cursorCanvas.height);
        }
    }

    /**
     * Animate cursor arrow pointing to target
     */
    #animateCursorArrow() {
        if (!this.#isCursorActive || !this.#cursorCtx || !this.#cursorTarget || this.#currentSectionIndex !== -1) {
            this.#stopCursorAnimation();
            return;
        }

        this.#clearCanvas();

        if (this.#mousePosition.x !== null && this.#mousePosition.y !== null) {
            const targetRect = this.#cursorTarget.getBoundingClientRect();
            const targetX = targetRect.left + targetRect.width / 2;
            const targetY = targetRect.top + targetRect.height / 2;

            const deltaX = targetX - this.#mousePosition.x;
            const deltaY = targetY - this.#mousePosition.y;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            if (distance > 50 && distance < 800) {
                const angle = Math.atan2(deltaY, deltaX);
                
                const startX = this.#mousePosition.x + Math.cos(angle) * 30;
                const startY = this.#mousePosition.y + Math.sin(angle) * 30;
                
                const arrowLength = Math.min(distance - 40, 120);
                const endX = startX + Math.cos(angle) * arrowLength;
                const endY = startY + Math.sin(angle) * arrowLength;

                this.#drawArrow(startX, startY, endX, endY);
            }
        }

        this.#cursorAnimationId = requestAnimationFrame(() => this.#animateCursorArrow());
    }

    /**
     * Draw arrow from start to end position
     */
    #drawArrow(startX, startY, endX, endY) {
        if (!this.#cursorCtx) return;

        const angle = Math.atan2(endY - startY, endX - startX);
        const arrowHeadLength = 15;
        const arrowHeadAngle = Math.PI / 6;

        const gradient = this.#cursorCtx.createLinearGradient(startX, startY, endX, endY);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.7)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 1)');

        this.#cursorCtx.shadowColor = '#3b82f6';
        this.#cursorCtx.shadowBlur = 8;
        this.#cursorCtx.shadowOffsetX = 0;
        this.#cursorCtx.shadowOffsetY = 0;

        this.#cursorCtx.strokeStyle = gradient;
        this.#cursorCtx.fillStyle = '#3b82f6';
        this.#cursorCtx.lineWidth = 2.5;
        this.#cursorCtx.lineCap = 'round';
        this.#cursorCtx.lineJoin = 'round';

        this.#cursorCtx.beginPath();
        this.#cursorCtx.moveTo(startX, startY);
        this.#cursorCtx.lineTo(endX, endY);
        this.#cursorCtx.stroke();

        this.#cursorCtx.beginPath();
        this.#cursorCtx.moveTo(endX, endY);
        this.#cursorCtx.lineTo(
            endX - arrowHeadLength * Math.cos(angle - arrowHeadAngle),
            endY - arrowHeadLength * Math.sin(angle - arrowHeadAngle)
        );
        this.#cursorCtx.lineTo(
            endX - arrowHeadLength * Math.cos(angle + arrowHeadAngle),
            endY - arrowHeadLength * Math.sin(angle + arrowHeadAngle)
        );
        this.#cursorCtx.closePath();
        this.#cursorCtx.fill();

        this.#cursorCtx.shadowBlur = 0;
    }

    /**
     * Generate scroll indicators from template
     */
    #generateScrollIndicators() {
        const scrollIndicatorData = [
            { container: '.hero-content', ariaLabel: 'Scroll down to start installation guide', nextText: 'Continue to installation guide', isHero: true },
            { container: 'article[data-step="intro"]', ariaLabel: 'Continue to step 1', nextText: 'Next: Download Fedora' },
            { container: 'article[data-step="1"]', ariaLabel: 'Continue to step 2', nextText: 'Next: Login as Root' },
            { container: 'article[data-step="2"]', ariaLabel: 'Continue to step 3', nextText: 'Next: Execute Installation' },
            { container: 'article[data-step="3"]', ariaLabel: 'Continue to step 4', nextText: 'Next: Configuration' },
            { container: 'article[data-step="4"]', ariaLabel: 'Continue to step 5', nextText: 'Next: Complete Setup' }
        ];

        scrollIndicatorData.forEach((data) => {
            const container = document.querySelector(data.container);
            if (!container || container.querySelector('.scroll-indicator')) return;

            const scrollIndicator = this.#createScrollIndicator(data.ariaLabel, data.nextText, data.isHero);
            container.appendChild(scrollIndicator);
        });
    }

    /**
     * Create a scroll indicator element
     */
    #createScrollIndicator(ariaLabel, nextText, isHero = false) {
        const button = document.createElement('button');
        button.className = isHero ? 'scroll-indicator backdrop-blur-10' : 'scroll-indicator step-scroll-indicator backdrop-blur-5';
        button.setAttribute('aria-label', ariaLabel);
        button.setAttribute('type', 'button');
        
        if (isHero) {
            button.id = 'hero-scroll-target';
        }

        const scrollArrow = document.createElement('div');
        scrollArrow.className = 'scroll-arrow';
        scrollArrow.setAttribute('aria-hidden', 'true');

        const srText = document.createElement('span');
        srText.className = 'sr-only';
        srText.textContent = nextText;

        button.append(scrollArrow, srText);
        return button;
    }

    /**
     * Generate HowTo JSON-LD from DOM content
     */
    #generateHowToJsonLD() {
        try {
            const baseUrl = globalThis.location.origin + globalThis.location.pathname;
            const steps = [];

            this.#sections.forEach((section) => {
                const stepId = section.getAttribute('data-step');
                const stepHeader = section.querySelector('h2');
                const stepContent = section.querySelector('.step-content p');
                
                if (stepId && stepHeader && stepContent) {
                    const position = stepId === 'intro' ? 0 : parseInt(stepId, 10);
                    
                    if (position > 0) {
                        steps.push({
                            "@type": "HowToStep",
                            "position": position,
                            "name": stepHeader.textContent.trim(),
                            "text": stepContent.textContent.trim(),
                            "url": `${baseUrl}#step-${stepId}`
                        });
                    }
                }
            });

            return {
                "@context": "https://schema.org",
                "@type": "HowTo",
                "name": document.title,
                "description": document.querySelector('meta[name="description"]')?.content || '',
                "inLanguage": "en",
                "url": baseUrl,
                "mainEntityOfPage": baseUrl,
                "totalTime": "PT30M",
                "estimatedCost": {
                    "@type": "MonetaryAmount",
                    "currency": "USD",
                    "value": "0"
                },
                "supply": [
                    {
                        "@type": "HowToSupply",
                        "name": "Computer with internet connection"
                    },
                    {
                        "@type": "HowToSupply",
                        "name": "USB drive (4GB or larger)"
                    },
                    {
                        "@type": "HowToSupply",
                        "name": "Fedora Everything ISO",
                        "url": "https://fedoraproject.org/everything/download"
                    }
                ],
                "tool": [
                    {
                        "@type": "HowToTool",
                        "name": "Fedora Media Writer",
                        "url": "https://fedoraproject.org/workstation/download"
                    },
                    {
                        "@type": "HowToTool",
                        "name": "dd or similar imaging tool"
                    }
                ],
                "step": steps
            };
        } catch (err) {
            error('Failed to generate HowTo JSON-LD:', err);
            return null;
        }
    }

    /**
     * Update the HowTo JSON-LD script
     */
    #updateHowToJsonLD() {
        try {
            const existingScript = document.getElementById('howto-schema');
            if (!existingScript) {
                warn('HowTo schema script not found, skipping update');
                return;
            }

            const generatedSchema = this.#generateHowToJsonLD();
            if (!generatedSchema) return;

            existingScript.textContent = JSON.stringify(generatedSchema, null, 4);
            log('HowTo JSON-LD updated from DOM content');
        } catch (err) {
            error('Failed to update HowTo JSON-LD:', err);
        }
    }

    /**
     * Cleanup method for removing event listeners and resources
     */
    destroy() {
        try {
            this.#stopCursorAnimation();
            
            document.querySelector('.toast')?.remove();

            if (this.#cursorAnimationId) {
                cancelAnimationFrame(this.#cursorAnimationId);
                this.#cursorAnimationId = null;
            }

            this.#progressEl = null;
            this.#collectedSteps = null;
            this.#sections = null;
            this.#hero = null;
            this.#cursorCanvas = null;
            this.#cursorCtx = null;
            this.#cursorTarget = null;
            
            log('FedoraInstallerUI destroyed successfully');
        } catch (err) {
            error('Failed to cleanup FedoraInstallerUI:', err);
        }
    }

    /**
     * Wire up the destroy method to lifecycle events
     */
    #wireUpDestroy() {
        try {
            globalThis.addEventListener('beforeunload', () => {
                this.destroy();
            });

            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    this.#stopCursorAnimation();
                }
            });

            log('Destroy method wired up to lifecycle events');
        } catch (err) {
            error('Failed to wire up destroy method:', err);
        }
    }
}

// Idempotent initialization guard
let __uiInstance = null;

/**
 * Initialize the application (idempotent)
 */
const initializeProgressiveEnhancements = () => {
    if (__uiInstance) return __uiInstance;
    
    try {
        if (!('requestAnimationFrame' in globalThis)) {
            throw new Error('RequestAnimationFrame not supported');
        }

        __uiInstance = new FedoraInstallerUI();
        
        // Setup progressive enhancement features
        setupCopyButtons();
        
        // Remove no-js class only after successful initialization
        document.documentElement.classList.remove('no-js');
        
        return __uiInstance;
        
    } catch (err) {
        error('Failed to initialize Fedora Installer UI:', err);
        showErrorToast('Something went wrong loading the page. Please refresh and try again.');
        return null;
    }
};

// Initialize when DOM is ready
document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', initializeProgressiveEnhancements)
    : initializeProgressiveEnhancements();

/**
 * Setup copy buttons functionality
 */
const setupCopyButtons = () => {
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('button.copy');
        if (!btn) return;
        
        e.preventDefault();
        
        const pre = btn.previousElementSibling;
        const codeBlock = pre?.querySelector('code') || pre;
        const text = codeBlock?.innerText || codeBlock?.textContent || '';
        
        if (!text.trim()) {
            showCopyFeedback(btn, false);
            return;
        }
        
        if (!navigator.clipboard?.writeText) {
            fallbackCopyText(text, btn);
            return;
        }
        
        navigator.clipboard.writeText(text).then(() => {
            showCopyFeedback(btn, true);
        }).catch((error) => {
            warn('Clipboard API failed, falling back:', error);
            fallbackCopyText(text, btn);
        });
    });
};

/**
 * Show visual feedback when text is copied
 */
const showCopyFeedback = (button, success = true) => {
    const originalText = button.textContent;
    const originalAriaLabel = button.getAttribute('aria-label') || '';
    
    button.classList.add(success ? 'copy-ok' : 'copy-fail');
    
    if (success) {
        button.textContent = 'Copied!';
        button.setAttribute('aria-label', 'Code copied to clipboard');
    } else {
        button.textContent = 'Failed';
        button.setAttribute('aria-label', 'Copy failed - please try manual copy');
    }
    
    setTimeout(() => {
        button.textContent = originalText;
        button.setAttribute('aria-label', originalAriaLabel);
        button.classList.remove('copy-ok', 'copy-fail');
    }, readCssTimings().copyFeedback);
};

/**
 * Fallback copy method for browsers without clipboard API
 */
const fallbackCopyText = (text, button) => {
    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.className = 'copy-helper-textarea';
        
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, 99999);
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        
        showCopyFeedback(button, successful);
        
        if (!successful) {
            warn('Document.execCommand copy failed');
        }
        
    } catch (err) {
        error('Fallback copy failed:', err);
        showCopyFeedback(button, false);
    }
};

/**
 * Show error toast notification
 */
const showErrorToast = (message) => {
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast toast-error';
        toast.setAttribute('hidden', '');
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        toast.setAttribute('aria-atomic', 'true');
        document.body.appendChild(toast);
    }
    
    // Reset any existing animation
    toast.classList.remove('toast-animate');
    toast.textContent = message;
    toast.classList.remove('toast-success');
    toast.classList.add('toast-error');
    toast.removeAttribute('hidden');
    
    // Start CSS animation lifecycle
    requestAnimationFrame(() => {
        toast.classList.add('toast-animate');
    });
    
    // Listen for animation end to hide toast
    const handleAnimationEnd = () => {
        toast.setAttribute('hidden', '');
        toast.classList.remove('toast-animate');
        toast.removeEventListener('animationend', handleAnimationEnd);
    };
    
    toast.addEventListener('animationend', handleAnimationEnd, { once: true });
};

// Expose minimal public API and close IIFE
root.FedoraApp = {
    enableDebug() {
        try {
            localStorage.setItem('debug', '1');
            console.log('%c✅ Debug mode enabled', 'color: #10b981; font-weight: bold;');
            console.log('Refresh page to activate debug logging');
        } catch (e) {
            console.warn('Could not enable debug mode:', e.message);
        }
    },
    disableDebug() {
        try {
            localStorage.removeItem('debug');
            console.log('%c❌ Debug mode disabled', 'color: #ef4444; font-weight: bold;');
            console.log('Refresh page to deactivate debug logging');
        } catch (e) {
            console.warn('Could not disable debug mode:', e.message);
        }
    },
    getInstance() {
        return __uiInstance;
    }
};

/**
 * Update progress offset CSS variable based on header height
 */
function updateProgressOffset() {
    const header = document.querySelector('.progress-container');
    const h = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty('--progress-offset', `${h}px`);
}

// Initialize progress offset handling
addEventListener('load', updateProgressOffset);
addEventListener('resize', updateProgressOffset);

// Watch for header size changes
const progressContainer = document.querySelector('.progress-container');
if (progressContainer && 'ResizeObserver' in globalThis) {
    new ResizeObserver(updateProgressOffset).observe(progressContainer);
}

/**
 * Electric pulse animation for hero grid
 */
(function initElectricPulses() {
    const GRID = 50;                 // skal matche background-size
    const MAX_CONCURRENT = 8;        // hard cap for performance
    const MIN_INTERVAL = 400;        // ms (øget fra 250)
    const MAX_INTERVAL = 1400;       // ms (øget fra 900)
    const MIN_LEN = 60;              // px (reduceret fra 80)
    const MAX_LEN = 350;             // px (øget fra 220)
    const SPEED_PX_PER_MS = 0.35;    // reduceret fra 0.6 for langsommere animation

    const hero = document.querySelector('.hero');
    if (!hero) return;

    let active = 0;
    let isActive = false;

    const rect = () => hero.getBoundingClientRect();
    const snap = v => Math.round(v / GRID) * GRID;

    function spawnPulse() {
        if (!isActive || active >= MAX_CONCURRENT) return scheduleNext();

        const r = rect();
        const horizontal = Math.random() < 0.5;

        // Vælg længde og position
        const len = Math.round(MIN_LEN + Math.random() * (MAX_LEN - MIN_LEN));
        const el = document.createElement('div');
        el.className = 'pulse-line ' + (horizontal ? 'h' : 'v');

        if (horizontal) {
            const y = snap(Math.random() * r.height);
            const x = Math.max(0, Math.min(r.width - len, snap(Math.random() * r.width) - len/2));
            el.style.inlineSize = `${len}px`;
            el.style.insetInlineStart = `${x}px`;
            el.style.insetBlockStart = `${y}px`;
            // lille "løb" langs linjen
            const drift = (Math.random() * 2 - 1) * GRID * 0.5;
            el.animate(
                [
                    { transform: `translateX(${drift}px)`, opacity: 0 },
                    { transform: `translateX(0px)`,       opacity: 0.9, offset: 0.12 },
                    { transform: `translateX(${-drift}px)`,opacity: 0.4, offset: 0.5 },
                    { transform: `translateX(${drift}px)`, opacity: 0 }
                ],
                { duration: Math.max(200, len / SPEED_PX_PER_MS), easing: 'linear' }
            ).addEventListener('finish', () => { 
                if (hero.contains(el)) {
                    hero.removeChild(el); 
                }
                active--; 
            });
        } else {
            const x = snap(Math.random() * r.width);
            const y = Math.max(0, Math.min(r.height - len, snap(Math.random() * r.height) - len/2));
            el.style.blockSize = `${len}px`;
            el.style.insetInlineStart = `${x}px`;
            el.style.insetBlockStart = `${y}px`;
            const drift = (Math.random() * 2 - 1) * GRID * 0.5;
            el.animate(
                [
                    { transform: `translateY(${drift}px)`, opacity: 0 },
                    { transform: `translateY(0px)`,        opacity: 0.9, offset: 0.12 },
                    { transform: `translateY(${-drift}px)`,opacity: 0.4, offset: 0.5 },
                    { transform: `translateY(${drift}px)`, opacity: 0 }
                ],
                { duration: Math.max(200, len / SPEED_PX_PER_MS), easing: 'linear' }
            ).addEventListener('finish', () => { 
                if (hero.contains(el)) {
                    hero.removeChild(el); 
                }
                active--; 
            });
        }

        hero.appendChild(el);
        active++;
        scheduleNext();
    }

    function scheduleNext() {
        if (!isActive) return;
        
        const t = MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL);
        setTimeout(() => {
            // batch i rAF for mindre layout-jitter
            requestAnimationFrame(spawnPulse);
        }, t);
    }

    function startPulses() {
        if (hero.classList.contains('visible') && !isActive) {
            isActive = true;
            scheduleNext();
        }
    }

    function stopPulses() {
        isActive = false;
    }

    // Observer for hero visibility changes
    const heroObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                if (hero.classList.contains('visible')) {
                    startPulses();
                } else {
                    stopPulses();
                }
            }
        });
    });

    heroObserver.observe(hero, { attributes: true, attributeFilter: ['class'] });

    // Start hvis hero allerede er synlig
    if (hero.classList.contains('visible')) {
        startPulses();
    }

    // Stop ved visibility change
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            stopPulses();
        } else if (hero.classList.contains('visible')) {
            startPulses();
        }
    });

    log('Electric pulse animation initialized');
})();

})(typeof window !== 'undefined' ? window : this);
