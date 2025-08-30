/**
 * Page transition and step collection functionality for Fedora GNOME installer website
 * @author Cadric
 * @description Provides page transitions, step collection, and navigation features
 */

// Configuration and debugging
const DEBUG = new URLSearchParams(window.location.search).has('debug');
const log = (...args) => DEBUG && console.log(...args);
const warn = (...args) => DEBUG && console.warn(...args);
const error = console.error.bind(console); // Always log errors

// Debug mode indicator
if (DEBUG) {
    console.log('%c🐛 Debug Mode Enabled', 'background: #3b82f6; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;');
    console.log('Add ?debug=1 to URL to enable debug logging');
}

// Global timing constants - read from CSS custom properties
let GLOBAL_TIMINGS = null;

/**
 * Read CSS timing custom properties and convert to milliseconds
 * @returns {Object} Timing constants in milliseconds
 */
function readCssTimings() {
    try {
        const styles = getComputedStyle(document.documentElement);
        const toMs = v => {
            if (!v) return 0;
            return v.endsWith('ms') ? parseFloat(v) : parseFloat(v) * 1000;
        };
        return {
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
    } catch (err) {
        console.error('Failed to read CSS timings, using fallbacks:', err);
        // Fallback timing values
        return {
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
    }
}

/**
 * Main application class for handling website interactions
 */
class FedoraInstallerUI {
    // Private fields
    #progressEl;
    #collectedSteps;
    #sections;
    #hero;
    #currentSectionIndex = -1; // Start with hero (-1), then sections (0, 1, 2...)
    #isTransitioning = false;
    #touchStartY = 0;
    #touchStartX = 0;
    
    // Mouse cursor arrow fields (Hero section only)
    #cursorCanvas;
    #cursorCtx;
    #cursorTarget;
    #mousePosition = { x: null, y: null };
    #cursorAnimationId = null;
    #isCursorActive = false;
    
    // Accessibility and motion preferences
    #prefersReducedMotion = false;
    
    // Centralized timing constants from CSS
    #timings = null;
    
    // Step titles mapping for collection
    #stepTitles = {
      'intro': 'Introduction',
      '1': 'Download Fedora Everything',
      '2': 'Login and Switch to Root',
      '3': 'Execute the Installation Script',
      '4': 'Answer Configuration Questions',
      '5': 'Enjoy Your New Desktop'
    };


    constructor() {
        // Detect user preferences
        this.#prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        // Initialize timing constants from CSS (shared with global timings)
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

            // Hide all sections initially except hero
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
     * Auto-inject copy buttons after each .code-block element
     */
    #initializeCopyButtons() {
        try {
            // Find all code blocks and inject copy buttons
            document.querySelectorAll('.code-block').forEach(block => {
                // Check if copy button already exists
                const existingBtn = block.nextElementSibling?.classList.contains('copy');
                if (existingBtn) return;

                // Create copy button
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'copy copy-btn';
                btn.setAttribute('aria-label', 'Copy code to clipboard');
                btn.setAttribute('title', 'Copy code');
                
                // Create button content with icon
                btn.innerHTML = `
                    <svg class="copy-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                    </svg>
                    <span class="copy-text">Copy</span>
                `;
                
                // Insert button after the code block
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
        // Make sure hero is visible initially
        if (this.#hero) {
            this.#hero.classList.add('visible');
        }
        
        // Set up initial state
        this.#currentSectionIndex = -1; // Hero is active
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
                warn('Cursor arrow elements not found - skipping cursor arrow initialization');
                return;
            }

            this.#cursorCtx = this.#cursorCanvas.getContext('2d');
            this.#updateCanvasSize();

            // Handle window resize
            window.addEventListener('resize', () => this.#updateCanvasSize());

            // Mouse position tracking (only when hero is visible)
            document.addEventListener('mousemove', (e) => {
                if (this.#currentSectionIndex === -1) { // Hero is active
                    this.#mousePosition.x = e.clientX;
                    this.#mousePosition.y = e.clientY;
                    
                    if (!this.#isCursorActive) {
                        this.#startCursorAnimation();
                    }
                }
            });

            // Hide cursor arrow when mouse leaves window, hero becomes inactive, or page is hidden
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
        // Scroll indicators (arrows)
        document.querySelectorAll('.scroll-indicator').forEach(indicator => {
            indicator.addEventListener('click', (e) => {
                e.preventDefault();
                this.#goToNextSection();
            });
        });

        // Keyboard navigation - improved focus handling
        document.addEventListener('keydown', (e) => {
            // Skip if inside form elements or content editable
            if (e.target.matches('input, textarea, select, [contenteditable="true"]')) {
                return;
            }
            
            switch(e.key) {
                case 'ArrowDown':
                case ' ':
                    e.preventDefault();
                    this.#goToNextSection();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.#goToPreviousSection();
                    break;
                case 'Home':
                    e.preventDefault();
                    this.#goToSection(-1); // Go to hero
                    break;
                case 'End':
                    e.preventDefault();
                    this.#goToSection(this.#sections.length - 1); // Go to last section
                    break;
            }
        });

        // Touch/swipe events for hero section
        this.#setupTouchHandlers(this.#hero);

        // Touch/swipe events for sections with scroll-aware handling
        this.#sections.forEach(section => {
            this.#setupTouchHandlers(section);
        });

        // Mouse wheel navigation with unified decision logic
        document.addEventListener('wheel', (e) => {
            if (this.#isTransitioning) return;
            
            // Use unified navigation decision logic
            if (!this.#shouldNavigateByWheelOrSwipe(e.deltaY, e.target)) {
                // Allow natural scrolling within the section
                return;
            }
            
            e.preventDefault();
            
            if (e.deltaY > 0) {
                // Scroll down - go to next section
                this.#goToNextSection();
            } else {
                // Scroll up - go to previous section
                this.#goToPreviousSection();
            }
        }, { passive: false });

        // Collected steps navigation with defensive parsing
        document.addEventListener('click', (e) => {
            if (e.target.closest('.collected-step')) {
                const stepElement = e.target.closest('.collected-step');
                const stepIndex = stepElement.dataset.stepIndex;
                const parsedIndex = Number.isInteger(+stepIndex) ? +stepIndex : null;
                
                if (parsedIndex !== null && parsedIndex >= -1 && parsedIndex < this.#sections.length) {
                    this.#goToSection(parsedIndex);
                }
            }
        });
        
        // History API support
        window.addEventListener('popstate', (e) => {
            this.#handleHistoryNavigation();
        });
    }

    /**
     * Setup touch event handlers for an element
     * @param {HTMLElement} element - Element to add touch handlers to
     */
    #setupTouchHandlers(element) {
        element.addEventListener('touchstart', (e) => {
            if (!e.touches?.length) return;
            this.#touchStartY = e.touches[0].clientY;
            this.#touchStartX = e.touches[0].clientX;
        }, { passive: true });

        // Only add touchmove for hero to prevent default scrolling
        if (element === this.#hero) {
            element.addEventListener('touchmove', (e) => {
                // Only prevent default if we're doing page transitions, not in scrollable areas
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
     * @param {TouchEvent} e - Touch event
     */
    #handleTouchEnd(e) {
        if (this.#isTransitioning || !e.changedTouches?.length) return;

        const touchEndY = e.changedTouches[0].clientY;
        const touchEndX = e.changedTouches[0].clientX;
        const deltaY = this.#touchStartY - touchEndY;
        const deltaX = this.#touchStartX - touchEndX;

        // Dead zone and angle check to avoid accidental swipes
        const minDistance = 24;
        const absDeltaY = Math.abs(deltaY);
        const absDeltaX = Math.abs(deltaX);
        
        if (absDeltaY < minDistance || absDeltaX > absDeltaY) {
            return; // Not a clear vertical swipe
        }

        // Use unified navigation decision logic
        if (!this.#shouldNavigateByWheelOrSwipe(deltaY > 0 ? 1 : -1, e.target)) {
            return; // Let native scrolling handle it
        }

        if (deltaY > 0) {
            // Swipe up - go to next section
            this.#goToNextSection();
        } else {
            // Swipe down - go to previous section
            this.#goToPreviousSection();
        }
    }

    /**
     * Check if event originated from a scrollable element
     * @param {Element} target - Event target
     * @returns {boolean} - True if from scrollable element
     */
    #isFromScrollableElement(target) {
        return target && target.closest('pre, code, textarea, .scroll, [data-scrollable="true"], .video-showcase');
    }

    /**
     * Check if we should allow scrolling within the current section
     * @param {WheelEvent} e - Wheel event
     * @returns {boolean} - True if section should scroll, false if should navigate
     */
    #shouldAllowSectionScroll(e) {
        // If we're on hero, always use page navigation
        if (this.#currentSectionIndex === -1) {
            return false;
        }

        // Get the current section element and its container
        const currentSection = this.#sections[this.#currentSectionIndex];
        if (!currentSection || !currentSection.classList.contains('visible')) {
            return false;
        }

        // Find the scrollable container within the section
        const container = currentSection.querySelector('.container');
        if (!container) {
            return false;
        }

        // Check if the container has scrollable content
        const scrollTop = container.scrollTop;
        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;
        
        // If content doesn't overflow, use page navigation
        if (scrollHeight <= clientHeight) {
            return false;
        }

        // Check scroll direction and position
        if (e.deltaY > 0) {
            // Scrolling down - allow if not at bottom
            const isAtBottom = Math.abs(scrollTop + clientHeight - scrollHeight) < 1;
            return !isAtBottom;
        } else {
            // Scrolling up - allow if not at top
            const isAtTop = scrollTop < 1;
            return !isAtTop;
        }
    }

    /**
     * Unified decision logic for wheel/touch navigation vs. scrolling
     * @param {number} deltaY - Scroll/swipe direction (positive = down)
     * @param {Element} originEl - Element where the interaction originated
     * @returns {boolean} - True if should navigate between sections, false if should scroll
     */
    #shouldNavigateByWheelOrSwipe(deltaY, originEl) {
        // Always navigate if on hero section
        if (this.#currentSectionIndex === -1) return true;
        
        // Never navigate if interaction came from scrollable element
        if (this.#isFromScrollableElement(originEl)) return false;
        
        // Check if current section should allow internal scrolling
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
        if (prevIndex >= -1) { // -1 is hero
            this.#goToSection(prevIndex);
        }
    }

    /**
     * Navigate to specific section
     * @param {number} sectionIndex - Section index (-1 for hero, 0+ for sections)
     */
    #goToSection(sectionIndex) {
        if (this.#isTransitioning || sectionIndex === this.#currentSectionIndex) return;
        
        this.#isTransitioning = true;
        
        // Stop cursor arrow when leaving hero section
        if (this.#currentSectionIndex === -1 && sectionIndex !== -1) {
            this.#stopCursorAnimation();
        }
        
        // Hide current section/hero
        if (this.#currentSectionIndex === -1) {
            // Currently on hero
            this.#hero.classList.remove('visible');
        } else {
            // Currently on a section
            const currentSection = this.#sections[this.#currentSectionIndex];
            if (currentSection) {
                currentSection.classList.remove('visible', 'active');
            }
        }

        // Update history API
        this.#updateHistory(sectionIndex);

        // Show target section/hero
        setTimeout(() => {
            if (sectionIndex === -1) {
                // Going to hero
                this.#hero.classList.add('visible');
            } else {
                // Going to a section
                const targetSection = this.#sections[sectionIndex];
                if (targetSection) {
                    targetSection.classList.add('visible', 'active');
                    
                    // Collect step
                    const stepId = targetSection.getAttribute('data-step');
                    if (stepId && this.#stepTitles[stepId]) {
                        this.#collectStep(stepId, this.#stepTitles[stepId], sectionIndex);
                    }
                }
            }
            
            this.#currentSectionIndex = sectionIndex;
            this.#updateProgressBar();
            
            // Allow next transition after animation
            setTimeout(() => {
                this.#isTransitioning = false;
            }, this.#timings.transition);
        }, this.#timings.quick);
    }

    /**
     * Render section immediately without animation (for initial page load)
     * @param {number} sectionIndex - Section index (-1 for hero, 0+ for sections)
     */
    #renderSectionImmediate(sectionIndex) {
        try {
            // Hide all sections and hero first
            this.#hero?.classList.remove('visible');
            this.#sections.forEach(section => {
                section.classList.remove('visible', 'active');
            });

            // Show target section/hero
            if (sectionIndex === -1) {
                // Show hero
                this.#hero?.classList.add('visible');
            } else if (sectionIndex >= 0 && sectionIndex < this.#sections.length) {
                // Show target section
                const targetSection = this.#sections[sectionIndex];
                if (targetSection) {
                    targetSection.classList.add('visible', 'active');
                    
                    // Collect step immediately (without animation)
                    const stepId = targetSection.getAttribute('data-step');
                    if (stepId && this.#stepTitles[stepId]) {
                        this.#collectStep(stepId, this.#stepTitles[stepId], sectionIndex);
                    }
                }
            }

            // Update internal state
            this.#currentSectionIndex = sectionIndex;
            this.#updateProgressBar();
            
        } catch (err) {
            error('Failed to render section immediately:', err);
        }
    }

    /**
     * Setup History API for deep linking and browser navigation
     */
    #setupHistoryAPI() {
        try {
            // Initialize from current hash if present
            const hash = window.location.hash;
            if (hash) {
                const sectionIndex = this.#getSectionIndexFromHash(hash);
                if (sectionIndex !== null && sectionIndex !== this.#currentSectionIndex) {
                    // Render section immediately without animation for initial load
                    this.#renderSectionImmediate(sectionIndex);
                }
            }
        } catch (err) {
            warn('Failed to setup history API:', err);
        }
    }

    /**
     * Update browser history
     * @param {number} sectionIndex - Current section index
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
            
            const currentHash = window.location.hash;
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
            const hash = window.location.hash;
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
     * @param {string} hash - URL hash
     * @returns {number|null} - Section index or null if invalid
     */
    #getSectionIndexFromHash(hash) {
        if (!hash || hash === '#') return -1; // Hero
        
        if (hash === '#intro') {
            // Find intro section
            for (let i = 0; i < this.#sections.length; i++) {
                if (this.#sections[i].getAttribute('data-step') === 'intro') {
                    return i;
                }
            }
        }
        
        const stepMatch = hash.match(/^#step-(\d+)$/);
        if (stepMatch) {
            const stepNumber = stepMatch[1];
            // Find section with matching step number
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
     * @param {string} stepId - The step identifier
     * @param {string} title - The step title
     * @param {number} sectionIndex - The index of the section being collected
     */
    #collectStep(stepId, title, sectionIndex) {
        try {
            // Check if step already exists
            const existingStep = this.#collectedSteps.querySelector(`[data-step-id="${stepId}"]`);
            if (existingStep) {
                this.#highlightElement(existingStep);
                return;
            }

            // Create new step element
            const stepElement = document.createElement('button');
            stepElement.className = 'collected-step';
            stepElement.setAttribute('data-step-id', stepId);
            stepElement.setAttribute('data-step-index', sectionIndex);
            stepElement.setAttribute('aria-label', `Go to ${title}`);
            stepElement.textContent = title;

            // Add click handler for navigation
            stepElement.addEventListener('click', (e) => {
                e.preventDefault();
                const index = parseInt(stepElement.dataset.stepIndex);
                if (!isNaN(index)) {
                    this.#goToSection(index);
                }
            });

            // Add step with animation using CSS classes instead of inline styles
            stepElement.classList.add('collected-step-entering');
            this.#collectedSteps.appendChild(stepElement);

            // Animate in using CSS transition
            requestAnimationFrame(() => {
                stepElement.classList.remove('collected-step-entering');
                stepElement.classList.add('collected-step-entered');
            });

            // Highlight the new step
            setTimeout(() => this.#highlightElement(stepElement), this.#timings.quick);

        } catch (err) {
            error('Failed to collect step:', err);
        }
    }

    /**
     * Highlight element with visual feedback
     * @param {HTMLElement} element - Element to highlight
     */
    #highlightElement(element) {
        try {
            element.classList.add('highlight');
            
            // Remove highlight after animation
            setTimeout(() => {
                element.classList.remove('highlight');
            }, this.#timings.highlight);
            
            // Add hover effects
            this.#addHoverEffects(element);
            
        } catch (err) {
            console.error('Failed to highlight element:', err);
        }
    }

    /**
     * Add hover effects to collected steps
     * @param {HTMLElement} element - Element to add effects to
     */
    #addHoverEffects(element) {
        try {
            // Use CSS classes instead of inline styles for hover effects
            element.classList.add('has-hover-effects');
        } catch (err) {
            error('Failed to add hover effects:', err);
        }
    }

    /**
     * Update progress bar based on current section
     */
    #updateProgressBar() {
        try {
            // Find total number of real steps (ignore intro)
            const stepSections = Array.from(this.#sections)
                .filter(s => s.dataset.step && s.dataset.step !== 'intro');
            const totalSteps = stepSections.length; // typically 5

            // Calculate current step number
            let currentStepNumber = 0; // 0 = Hero/Intro
            if (this.#currentSectionIndex >= 0) {
                const active = this.#sections[this.#currentSectionIndex];
                const id = active?.dataset?.step ?? null;
                if (id && id !== 'intro') {
                    const parsed = parseInt(id, 10);
                    currentStepNumber = Number.isInteger(parsed) ? parsed : 0;
                }
            }

            // Progress: 0% on hero/intro, 100% on step 5
            const progress = totalSteps > 0
                ? Math.min(100, Math.max(0, (currentStepNumber / totalSteps) * 100))
                : 0;

            const progressEl = this.#progressEl;
            if (progressEl) {
                // Use semantic progress element
                progressEl.value = progress;
                progressEl.setAttribute('aria-valuenow', String(Math.round(progress)));
                
                // Update aria-valuetext for better screen reader experience
                const stepText = currentStepNumber > 0 
                    ? `Step ${currentStepNumber} of ${totalSteps}`
                    : 'Getting started';
                progressEl.setAttribute('aria-valuetext', stepText);
            }
        } catch (err) {
            error('Failed to update progress bar:', err);
        }
    }


    /**
     * Initialize showcase video with enhanced loading and interaction
     */
    #initializeShowcaseVideo() {
        const video = document.querySelector('.showcase-video');
        if (!video) return;

        try {
            // Set up loading detection
            const handleVideoLoad = () => {
                video.setAttribute('data-loaded', 'true');
                video.setAttribute('aria-busy', 'false');
                log('Showcase video loaded successfully');
            };

            // Handle load events
            if (video.readyState >= 3) {
                // Video already loaded
                handleVideoLoad();
            } else {
                video.addEventListener('loadeddata', handleVideoLoad, { once: true });
                video.addEventListener('canplaythrough', handleVideoLoad, { once: true });
                video.addEventListener('loadedmetadata', () => {
                    video.setAttribute('aria-busy', 'false');
                }, { once: true });
            }

            // Error handling
            video.addEventListener('error', (error) => {
                error('Video failed to load:', error);
                this.#handleVideoError(video);
            }, { once: true });

            // Initialize video controls
            this.#initializeVideoControls(video);

            // Handle user interaction preferences
            this.#respectUserPreferences(video);

        } catch (err) {
            error('Failed to initialize showcase video:', err);
            this.#handleVideoError(video);
        }
    }

    /**
     * Initialize custom video controls
     * @param {HTMLVideoElement} video 
     */
    #initializeVideoControls(video) {
        const playPauseBtn = document.getElementById('play-pause-btn');
        const playOverlay = document.getElementById('video-play-overlay');

        if (!playPauseBtn) return;

        // Play/Pause functionality for control button
        playPauseBtn.addEventListener('click', () => {
            if (video.paused) {
                video.play().catch(error => {
                    console.log('Play failed:', error.name);
                });
            } else {
                video.pause();
            }
        });

        // Large play overlay functionality
        if (playOverlay) {
            const overlayBtn = playOverlay.querySelector('.video-play-overlay-btn');
            if (overlayBtn) {
                overlayBtn.addEventListener('click', () => {
                    video.play().catch(error => {
                        console.log('Play failed:', error.name);
                        this.#handleVideoPlayError(error);
                    });
                    // Hide overlay after clicking
                    playOverlay.classList.add('hidden');
                });
            }
        }

        // Update button states when video state changes
        video.addEventListener('play', () => {
            this.#updatePlayPauseButton(true);
            // Hide overlay when video starts playing
            if (playOverlay) {
                playOverlay.classList.add('hidden');
            }
        });
        video.addEventListener('pause', () => {
            this.#updatePlayPauseButton(false);
            // Show overlay when video is paused
            if (playOverlay) {
                playOverlay.classList.remove('hidden');
            }
        });

        // Initialize button states
        this.#updatePlayPauseButton(!video.paused);
    }

    /**
     * Update play/pause button appearance
     * @param {boolean} isPlaying 
     */
    #updatePlayPauseButton(isPlaying) {
        const playPauseBtn = document.getElementById('play-pause-btn');
        if (!playPauseBtn) return;

        const playIcon = playPauseBtn.querySelector('.play-icon');
        const pauseIcon = playPauseBtn.querySelector('.pause-icon');

        if (isPlaying) {
            // Use CSS classes instead of inline styles
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
     * @param {HTMLVideoElement} video 
     */
    #respectUserPreferences(video) {
        // Respect prefers-reduced-motion
        if (this.#prefersReducedMotion) {
            video.setAttribute('preload', 'metadata');
            video.removeAttribute('autoplay');
            this.#addVideoPlayButton(video);
        }

        // Respect data saver preferences (if supported)
        if (navigator.connection?.saveData) {
            video.setAttribute('preload', 'none');
            video.removeAttribute('autoplay');
            this.#addVideoPlayButton(video);
        }

        // iOS autoplay gate - require user interaction
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (isIOS && video.hasAttribute('autoplay')) {
            video.removeAttribute('autoplay');
            this.#addVideoPlayButton(video);
        }
    }

    /**
     * Add a manual play button for users with data constraints
     * @param {HTMLVideoElement} video 
     */
    #addVideoPlayButton(video) {
        // Create play button using createElement for CSP compliance
        const playButton = document.createElement('button');
        playButton.className = 'video-play-button backdrop-blur-8';
        playButton.setAttribute('aria-label', 'Play installation demo video');
        
        // Create SVG icon
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

        // Handle click - no inline event handlers
        playButton.addEventListener('click', () => {
            video.play().catch(error => {
                error('Video play failed:', error);
                this.#handleVideoPlayError(error);
            });
            playButton.remove();
        });

        // Add button to video container
        const videoContainer = video.closest('.video-showcase');
        if (videoContainer) {
            videoContainer.appendChild(playButton);
        }
    }

    /**
     * Handle video loading errors gracefully
     * @param {HTMLVideoElement} video 
     */
    #handleVideoError(video) {
        const videoContainer = video.closest('.video-showcase');
        if (!videoContainer) return;

        // Create fallback content using createElement for CSP compliance
        const fallback = document.createElement('div');
        fallback.className = 'video-fallback';
        
        const content = document.createElement('div');
        content.className = 'video-fallback-content';
        
        // Create SVG icon
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '64');
        svg.setAttribute('height', '64');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'currentColor');
        // Use CSS class instead of inline style for CSP compliance
        svg.classList.add('is-muted');
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z');
        svg.appendChild(path);
        
        const title = document.createElement('h3');
        title.textContent = 'Installation Demo';
        
        const description = document.createElement('p');
        description.textContent = 'Experience the smooth, automated Fedora GNOME installation process.';
        
        const link = document.createElement('a');
        link.href = 'https://ifg.sh/showcase-v1.mp4';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'fallback-link';
        link.textContent = 'View Demo Video →';
        
        content.appendChild(svg);
        content.appendChild(title);
        content.appendChild(description);
        content.appendChild(link);
        fallback.appendChild(content);

        // Apply fallback styles via CSS classes instead of inline styles
        fallback.classList.add('video-error-fallback');

        // Replace video with fallback
        video.replaceWith(fallback);
    }

    /**
     * Handle video play errors consistently
     * @param {Error} error - The play error
     */
    #handleVideoPlayError(error) {
        warn('Video play failed:', error.name, error.message);
        showErrorToast('Failed to play video. Please try again.');
    }



    /**
     * Initialize the application
     */
    #initialize() {
        this.#updateProgressBar();
        this.#initializeShowcaseVideo();
        
        // Generate HowTo JSON-LD from DOM content (low priority enhancement)
        if (DEBUG) {
            this.#updateHowToJsonLD();
        }
        
        log('Fedora GNOME installer website loaded with page transitions!');
    }

    /**
     * Read CSS timing custom properties and convert to milliseconds
     * @returns {Object} Timing constants in milliseconds
     */
    #readCssTimings() {
        // Use the shared global function
        return readCssTimings();
    }

    /**
     * Update canvas size to match viewport
     */
    #updateCanvasSize() {
        if (!this.#cursorCanvas) return;
        
        this.#cursorCanvas.width = window.innerWidth;
        this.#cursorCanvas.height = window.innerHeight;
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

        // Clear canvas
        this.#clearCanvas();

        if (this.#mousePosition.x !== null && this.#mousePosition.y !== null) {
            // Get target position
            const targetRect = this.#cursorTarget.getBoundingClientRect();
            const targetX = targetRect.left + targetRect.width / 2;
            const targetY = targetRect.top + targetRect.height / 2;

            // Calculate arrow properties
            const deltaX = targetX - this.#mousePosition.x;
            const deltaY = targetY - this.#mousePosition.y;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            // Only show arrow if mouse is not too close to target and distance is reasonable
            if (distance > 50 && distance < 800) {
                const angle = Math.atan2(deltaY, deltaX);
                
                // Arrow start position (near mouse cursor)
                const startX = this.#mousePosition.x + Math.cos(angle) * 30;
                const startY = this.#mousePosition.y + Math.sin(angle) * 30;
                
                // Arrow end position (closer to target but not touching)
                const arrowLength = Math.min(distance - 40, 120);
                const endX = startX + Math.cos(angle) * arrowLength;
                const endY = startY + Math.sin(angle) * arrowLength;

                // Draw arrow
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

        // Create gradient for arrow
        const gradient = this.#cursorCtx.createLinearGradient(startX, startY, endX, endY);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.7)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 1)');

        // Add subtle glow effect
        this.#cursorCtx.shadowColor = '#3b82f6';
        this.#cursorCtx.shadowBlur = 8;
        this.#cursorCtx.shadowOffsetX = 0;
        this.#cursorCtx.shadowOffsetY = 0;

        // Set arrow style
        this.#cursorCtx.strokeStyle = gradient;
        this.#cursorCtx.fillStyle = '#3b82f6';
        this.#cursorCtx.lineWidth = 2.5;
        this.#cursorCtx.lineCap = 'round';
        this.#cursorCtx.lineJoin = 'round';

        // Draw arrow shaft
        this.#cursorCtx.beginPath();
        this.#cursorCtx.moveTo(startX, startY);
        this.#cursorCtx.lineTo(endX, endY);
        this.#cursorCtx.stroke();

        // Draw arrow head
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

        // Reset shadow for next drawing
        this.#cursorCtx.shadowBlur = 0;
    }

    /**
     * Cleanup method for removing event listeners and resources
     */
    destroy() {
        try {
            // Stop cursor animation
            this.#stopCursorAnimation();
            
            // Remove toast if it exists
            const toast = document.querySelector('.toast');
            if (toast) {
                toast.remove();
            }

            // Clear any pending timers
            if (this.#cursorAnimationId) {
                cancelAnimationFrame(this.#cursorAnimationId);
                this.#cursorAnimationId = null;
            }

            // Clear references to DOM elements
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
            // Clean up on page unload
            window.addEventListener('beforeunload', () => {
                this.destroy();
            });

            // Clean up on page visibility change (when tab is closed/hidden)
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    // Page is hidden, do partial cleanup
                    this.#stopCursorAnimation();
                }
            });

            log('Destroy method wired up to lifecycle events');
        } catch (err) {
            error('Failed to wire up destroy method:', err);
        }
    }

    /**
     * Generate scroll indicators from template to eliminate duplication
     */
    #generateScrollIndicators() {
        // Define scroll indicator data
        const scrollIndicatorData = [
            { container: '.hero-content', ariaLabel: 'Scroll down to start installation guide', nextText: 'Continue to installation guide', isHero: true },
            { container: 'article[data-step="intro"]', ariaLabel: 'Continue to step 1', nextText: 'Next: Download Fedora' },
            { container: 'article[data-step="1"]', ariaLabel: 'Continue to step 2', nextText: 'Next: Login as Root' },
            { container: 'article[data-step="2"]', ariaLabel: 'Continue to step 3', nextText: 'Next: Execute Installation' },
            { container: 'article[data-step="3"]', ariaLabel: 'Continue to step 4', nextText: 'Next: Configuration' },
            { container: 'article[data-step="4"]', ariaLabel: 'Continue to step 5', nextText: 'Next: Complete Setup' }
        ];

        scrollIndicatorData.forEach((data, index) => {
            const container = document.querySelector(data.container);
            if (!container) return;

            // Check if scroll indicator already exists (to avoid duplicating on re-init)
            if (container.querySelector('.scroll-indicator')) return;

            const scrollIndicator = this.#createScrollIndicator(data.ariaLabel, data.nextText, data.isHero);
            container.appendChild(scrollIndicator);
        });
    }

    /**
     * Create a scroll indicator element from template
     */
    #createScrollIndicator(ariaLabel, nextText, isHero = false) {
        const button = document.createElement('button');
        button.className = isHero ? 'scroll-indicator backdrop-blur-10' : 'scroll-indicator step-scroll-indicator backdrop-blur-5';
        button.setAttribute('aria-label', ariaLabel);
        button.setAttribute('type', 'button');
        
        if (isHero) {
            button.id = 'hero-scroll-target';
        }

        // Create scroll arrow
        const scrollArrow = document.createElement('div');
        scrollArrow.className = 'scroll-arrow';
        scrollArrow.setAttribute('aria-hidden', 'true');

        // Create screen reader text
        const srText = document.createElement('span');
        srText.className = 'sr-only';
        srText.textContent = nextText;

        button.appendChild(scrollArrow);
        button.appendChild(srText);

        return button;
    }

    /**
     * Generate HowTo JSON-LD from DOM content to prevent drift
     * @returns {Object} JSON-LD structured data object
     */
    #generateHowToJsonLD() {
        try {
            const baseUrl = window.location.origin + window.location.pathname;
            const steps = [];

            // Extract steps from DOM sections
            this.#sections.forEach((section, index) => {
                const stepId = section.getAttribute('data-step');
                const stepHeader = section.querySelector('h2');
                const stepContent = section.querySelector('.step-content p');
                
                if (stepId && stepHeader && stepContent) {
                    // Skip intro section for numbering
                    const position = stepId === 'intro' ? 0 : parseInt(stepId, 10);
                    
                    if (position > 0) { // Only include numbered steps
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
     * Update the HowTo JSON-LD script with DOM-generated content
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

            // Update the script content
            existingScript.textContent = JSON.stringify(generatedSchema, null, 4);
            log('HowTo JSON-LD updated from DOM content');
        } catch (err) {
            error('Failed to update HowTo JSON-LD:', err);
        }
    }

    // ...existing code...
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize global timings first
    GLOBAL_TIMINGS = readCssTimings();
    
    try {
        // Feature detection for required APIs
        if (!('requestAnimationFrame' in window)) {
            throw new Error('RequestAnimationFrame not supported');
        }

        // Initialize the main application
        const installerUI = new FedoraInstallerUI();
        
        // Store reference for potential cleanup
        window.installerUI = installerUI;
        
        // Progressive enhancement features
        initializeProgressiveEnhancements();
        
    } catch (err) {
        error('Failed to initialize Fedora Installer UI:', err);
        
        // Show user-friendly error message using toast
        showErrorToast('Something went wrong loading the page. Please refresh and try again.');
    }
});

/**
 * Initialize progressive enhancement features
 * No frameworks, only modern browser APIs with graceful fallbacks
 */
function initializeProgressiveEnhancements() {
    // Copy button functionality for code blocks
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('button.copy');
        if (!btn) return;
        
        e.preventDefault();
        
        // Find the code content to copy
        const pre = btn.previousElementSibling;
        const codeBlock = pre?.querySelector('code') || pre;
        const text = codeBlock?.innerText || codeBlock?.textContent || '';
        
        if (!text.trim()) {
            showCopyFeedback(btn, false);
            return;
        }
        
        // Feature detection for clipboard API
        if (!navigator.clipboard?.writeText) {
            fallbackCopyText(text, btn);
            return;
        }
        
        // Modern clipboard API
        navigator.clipboard.writeText(text).then(() => {
            showCopyFeedback(btn, true);
        }).catch((error) => {
            warn('Clipboard API failed, falling back:', error);
            fallbackCopyText(text, btn);
        });
    });
    
    // Smooth skip-link focus handling for accessibility
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', (e) => {
            const targetId = anchor.getAttribute('href').slice(1);
            const targetElement = targetId ? document.getElementById(targetId) : null;
            
            if (targetElement) {
                e.preventDefault();
                
                // Respect reduced motion preference
                const smoothOK = !matchMedia('(prefers-reduced-motion: reduce)').matches;
                
                // Set focus with proper tabindex handling
                const priorTabindex = targetElement.getAttribute('tabindex');
                targetElement.setAttribute('tabindex', '-1');
                
                targetElement.focus({ preventScroll: true });
                targetElement.scrollIntoView({ 
                    behavior: smoothOK ? 'smooth' : 'auto', 
                    block: 'start' 
                });
                
                // Restore original tabindex
                if (priorTabindex === null) {
                    targetElement.removeAttribute('tabindex');
                } else {
                    targetElement.setAttribute('tabindex', priorTabindex);
                }
            }
        });
    });
    
    log('Progressive enhancement features initialized');
}

/**
 * Show visual feedback when text is copied
 * @param {HTMLElement} button - The copy button element
 * @param {boolean} success - Whether the copy operation was successful
 */
function showCopyFeedback(button, success = true) {
    // Store original state
    const originalText = button.textContent;
    const originalAriaLabel = button.getAttribute('aria-label') || '';
    
    // Update button state using CSS classes instead of inline styles
    button.classList.add(success ? 'copy-ok' : 'copy-fail');
    
    // Update text and aria-label
    if (success) {
        button.textContent = 'Copied!';
        button.setAttribute('aria-label', 'Code copied to clipboard');
    } else {
        button.textContent = 'Failed';
        button.setAttribute('aria-label', 'Copy failed - please try manual copy');
    }
    
    // Reset button after delay
    setTimeout(() => {
        button.textContent = originalText;
        button.setAttribute('aria-label', originalAriaLabel);
        button.classList.remove('copy-ok', 'copy-fail');
    }, GLOBAL_TIMINGS?.copyFeedback || 1500);
}

/**
 * Fallback copy method for browsers without clipboard API
 * @param {string} text - Text to copy
 * @param {HTMLElement} button - The copy button element
 */
function fallbackCopyText(text, button) {
    try {
        // Create a temporary textarea element
        const textarea = document.createElement('textarea');
        textarea.value = text;
        
        // Position off-screen using CSS classes
        textarea.className = 'copy-helper-textarea';
        
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, 99999); // For mobile devices
        
        // Execute copy command
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
}

/**
 * Show error toast notification (global function for reuse)
 * @param {string} message - Error message to display
 */
function showErrorToast(message) {
    // Create or reuse existing toast
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast toast-error';
        toast.setAttribute('hidden', '');
        // Add accessibility attributes for assistive technologies
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        toast.setAttribute('aria-atomic', 'true');
        document.body.appendChild(toast);
    }
    
    toast.textContent = message;
    toast.classList.remove('toast-success');
    toast.classList.add('toast-error');
    toast.removeAttribute('hidden');
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        toast.setAttribute('hidden', '');
    }, GLOBAL_TIMINGS?.toastDuration || 5000);
}