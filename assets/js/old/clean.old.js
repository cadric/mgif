/**
 * Fedora GNOME Installer Website - Modern JavaScript Application
 * @author Cadric
 * @description Ultra-modern page transitions, step collection, and navigation features
 * @version 2.0.0
 */

// Configuration and debugging
const DEBUG = new URLSearchParams(globalThis.location.search).has('debug');
const log = (...args) => DEBUG && console.log(...args);
const warn = (...args) => DEBUG && console.warn(...args);
const error = console.error.bind(console); // Always log errors

// Debug mode indicator
if (DEBUG) {
    console.log('%c🐛 Debug Mode Enabled', 'background: #3b82f6; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;');
    console.log('Add ?debug=1 to URL to enable debug logging');
}

/**
 * CSS timing utilities - read from CSS custom properties
 */
class CSSTimings {
    static #cachedTimings = null;
    
    /**
     * Read CSS timing custom properties and convert to milliseconds
     * @returns {Object} Timing constants in milliseconds
     */
    static read() {
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
     * Get singleton instance of timing values
     */
    static get instance() {
        if (!this.#cachedTimings) {
            this.#cachedTimings = this.read();
        }
        return this.#cachedTimings;
    }
}

/**
 * Cursor arrow animation system for Hero section
 */
class CursorArrow {
    #canvas;
    #ctx;
    #target;
    #mousePosition = { x: null, y: null };
    #animationId = null;
    #isActive = false;
    
    constructor(canvasId, targetId) {
        try {
            this.#canvas = document.getElementById(canvasId);
            this.#target = document.getElementById(targetId);
            
            if (!this.#canvas || !this.#target) {
                warn('Cursor arrow elements not found - skipping initialization');
                return;
            }

            this.#ctx = this.#canvas.getContext('2d');
            this.#updateCanvasSize();

            // Handle window resize
            globalThis.addEventListener('resize', () => this.#updateCanvasSize());
        } catch (err) {
            error('Failed to initialize cursor arrow:', err);
        }
    }
    
    /**
     * Update canvas size to match viewport
     */
    #updateCanvasSize() {
        if (!this.#canvas) return;
        
        this.#canvas.width = globalThis.innerWidth;
        this.#canvas.height = globalThis.innerHeight;
    }
    
    /**
     * Update mouse position
     */
    updateMousePosition(x, y) {
        this.#mousePosition = { x, y };
        
        if (!this.#isActive) {
            this.start();
        }
    }
    
    /**
     * Start cursor arrow animation
     */
    start() {
        if (this.#isActive || !this.#canvas) return;
        
        this.#isActive = true;
        this.#canvas.classList.add('active');
        this.#animate();
    }
    
    /**
     * Stop cursor arrow animation
     */
    stop() {
        this.#isActive = false;
        
        if (this.#animationId) {
            cancelAnimationFrame(this.#animationId);
            this.#animationId = null;
        }
        
        this.#canvas?.classList.remove('active');
        this.#clearCanvas();
    }
    
    /**
     * Clear the cursor canvas
     */
    #clearCanvas() {
        if (this.#ctx && this.#canvas) {
            this.#ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
        }
    }
    
    /**
     * Animate cursor arrow pointing to target
     */
    #animate() {
        if (!this.#isActive || !this.#ctx || !this.#target) {
            this.stop();
            return;
        }

        this.#clearCanvas();

        if (this.#mousePosition.x !== null && this.#mousePosition.y !== null) {
            const targetRect = this.#target.getBoundingClientRect();
            const targetX = targetRect.left + targetRect.width / 2;
            const targetY = targetRect.top + targetRect.height / 2;

            const deltaX = targetX - this.#mousePosition.x;
            const deltaY = targetY - this.#mousePosition.y;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            // Only show arrow if mouse is not too close to target and distance is reasonable
            if (distance > 50 && distance < 800) {
                const angle = Math.atan2(deltaY, deltaX);
                
                const startX = this.#mousePosition.x + Math.cos(angle) * 30;
                const startY = this.#mousePosition.y + Math.sin(angle) * 30;
                
                const endX = targetX - Math.cos(angle) * 60;
                const endY = targetY - Math.sin(angle) * 60;
                
                this.#drawArrow(startX, startY, endX, endY);
            }
        }

        this.#animationId = requestAnimationFrame(() => this.#animate());
    }
    
    /**
     * Draw arrow from start to end position
     */
    #drawArrow(startX, startY, endX, endY) {
        if (!this.#ctx) return;

        const angle = Math.atan2(endY - startY, endX - startX);
        const arrowHeadLength = 15;
        const arrowHeadAngle = Math.PI / 6;

        // Create gradient for arrow
        const gradient = this.#ctx.createLinearGradient(startX, startY, endX, endY);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.7)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 1)');

        // Add subtle glow effect
        this.#ctx.shadowColor = '#3b82f6';
        this.#ctx.shadowBlur = 8;
        this.#ctx.shadowOffsetX = 0;
        this.#ctx.shadowOffsetY = 0;

        // Set arrow style
        this.#ctx.strokeStyle = gradient;
        this.#ctx.fillStyle = '#3b82f6';
        this.#ctx.lineWidth = 2.5;
        this.#ctx.lineCap = 'round';
        this.#ctx.lineJoin = 'round';

        // Draw arrow shaft
        this.#ctx.beginPath();
        this.#ctx.moveTo(startX, startY);
        this.#ctx.lineTo(endX, endY);
        this.#ctx.stroke();

        // Draw arrow head
        this.#ctx.beginPath();
        this.#ctx.moveTo(endX, endY);
        this.#ctx.lineTo(
            endX - arrowHeadLength * Math.cos(angle - arrowHeadAngle),
            endY - arrowHeadLength * Math.sin(angle - arrowHeadAngle)
        );
        this.#ctx.lineTo(
            endX - arrowHeadLength * Math.cos(angle + arrowHeadAngle),
            endY - arrowHeadLength * Math.sin(angle + arrowHeadAngle)
        );
        this.#ctx.closePath();
        this.#ctx.fill();

        // Reset shadow for next drawing
        this.#ctx.shadowBlur = 0;
    }
}

/**
 * Video management system
 */
class VideoManager {
    #video;
    #playPauseBtn;
    #playOverlay;
    #prefersReducedMotion;
    
    constructor(videoSelector) {
        this.#video = document.querySelector(videoSelector);
        if (!this.#video) return;
        
        this.#prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.#playPauseBtn = document.getElementById('play-pause-btn');
        this.#playOverlay = document.getElementById('video-play-overlay');
        
        this.#initialize();
    }
    
    /**
     * Initialize video with enhanced loading and interaction
     */
    #initialize() {
        try {
            // Set up loading detection
            const handleVideoLoad = () => {
                this.#video.setAttribute('data-loaded', 'true');
                this.#video.setAttribute('aria-busy', 'false');
                log('Showcase video loaded successfully');
            };

            // Handle load events
            if (this.#video.readyState >= 3) {
                handleVideoLoad();
            } else {
                this.#video.addEventListener('loadeddata', handleVideoLoad, { once: true });
                this.#video.addEventListener('canplaythrough', handleVideoLoad, { once: true });
                this.#video.addEventListener('loadedmetadata', () => {
                    log('Video metadata loaded');
                }, { once: true });
            }

            // Error handling
            this.#video.addEventListener('error', (error) => {
                error('Video failed to load:', error);
                this.#handleVideoError();
            }, { once: true });

            // Initialize video controls
            this.#initializeControls();

            // Handle user interaction preferences
            this.#respectUserPreferences();

        } catch (err) {
            error('Failed to initialize showcase video:', err);
            this.#handleVideoError();
        }
    }
    
    /**
     * Initialize custom video controls
     */
    #initializeControls() {
        if (!this.#playPauseBtn) return;

        // Play/Pause functionality for control button
        this.#playPauseBtn.addEventListener('click', async () => {
            try {
                if (this.#video.paused) {
                    await this.#video.play();
                } else {
                    this.#video.pause();
                }
            } catch (err) {
                error('Video play/pause failed:', err);
                showErrorToast('Failed to control video playback.');
            }
        });

        // Large play overlay functionality
        const overlayBtn = this.#playOverlay?.querySelector('.video-play-overlay-btn');
        if (overlayBtn) {
            overlayBtn.addEventListener('click', async () => {
                try {
                    await this.#video.play();
                } catch (err) {
                    error('Video play failed:', err);
                    showErrorToast('Failed to play video.');
                }
            });
        }

        // Update button states when video state changes
        this.#video.addEventListener('play', () => {
            this.#updatePlayPauseButton(true);
            this.#playOverlay?.classList.add('hidden');
        });
        
        this.#video.addEventListener('pause', () => {
            this.#updatePlayPauseButton(false);
            this.#playOverlay?.classList.remove('hidden');
        });

        // Initialize button states
        this.#updatePlayPauseButton(!this.#video.paused);
    }
    
    /**
     * Update play/pause button appearance
     */
    #updatePlayPauseButton(isPlaying) {
        if (!this.#playPauseBtn) return;

        const playIcon = this.#playPauseBtn.querySelector('.play-icon');
        const pauseIcon = this.#playPauseBtn.querySelector('.pause-icon');

        if (isPlaying) {
            playIcon?.classList.add('hidden');
            pauseIcon?.classList.remove('hidden');
            this.#playPauseBtn.setAttribute('aria-label', 'Pause video');
        } else {
            playIcon?.classList.remove('hidden');
            pauseIcon?.classList.add('hidden');
            this.#playPauseBtn.setAttribute('aria-label', 'Play video');
        }
    }
    
    /**
     * Respect user preferences for motion and data usage
     */
    #respectUserPreferences() {
        // Respect prefers-reduced-motion
        if (this.#prefersReducedMotion) {
            this.#video.setAttribute('preload', 'metadata');
            this.#video.removeAttribute('autoplay');
            this.#addVideoPlayButton();
        }

        // Respect data saver preferences (if supported)
        if (navigator.connection?.saveData) {
            this.#video.setAttribute('preload', 'none');
            this.#video.removeAttribute('autoplay');
            this.#addVideoPlayButton();
        }

        // iOS autoplay gate - require user interaction
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (isIOS && this.#video.hasAttribute('autoplay')) {
            this.#video.removeAttribute('autoplay');
            this.#addVideoPlayButton();
        }
    }
    
    /**
     * Add a manual play button for users with data constraints
     */
    #addVideoPlayButton() {
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

        // Handle click
        playButton.addEventListener('click', async () => {
            try {
                await this.#video.play();
                playButton.remove();
            } catch (err) {
                error('Video play failed:', err);
                showErrorToast('Failed to play video.');
            }
        });

        // Add button to video container
        const videoContainer = this.#video.closest('.video-showcase');
        videoContainer?.appendChild(playButton);
    }
    
    /**
     * Handle video loading errors gracefully
     */
    #handleVideoError() {
        const videoContainer = this.#video.closest('.video-showcase');
        if (!videoContainer) return;

        const fallback = document.createElement('div');
        fallback.className = 'video-fallback video-error-fallback';
        
        const content = document.createElement('div');
        content.className = 'video-fallback-content';
        
        // Create SVG icon
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

        // Replace video with fallback
        this.#video.replaceWith(fallback);
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
    
    // Mouse cursor arrow (Hero section only)
    #cursorArrow;
    
    // Accessibility and motion preferences
    #prefersReducedMotion = false;
    
    // Centralized timing constants from CSS
    #timings;
    
    // Video manager
    #videoManager;
    
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
        
        // Initialize timing constants from CSS
        this.#timings = CSSTimings.instance;
        
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
     */
    #initializeCopyButtons() {
        try {
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
        this.#hero?.classList.add('visible');
        
        // Set up initial state
        this.#currentSectionIndex = -1; // Hero is active
        this.#updateProgressBar();
    }

    /**
     * Initialize cursor arrow system for Hero section
     */
    #initializeCursorArrow() {
        this.#cursorArrow = new CursorArrow('hero-cursor-overlay', 'hero-scroll-target');
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
                    this.#goToSection(-1);
                    break;
                case 'End':
                    e.preventDefault();
                    this.#goToSection(this.#sections.length - 1);
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
                return; // Allow natural scrolling within the section
            }
            
            e.preventDefault();
            
            if (e.deltaY > 0) {
                this.#goToNextSection();
            } else {
                this.#goToPreviousSection();
            }
        }, { passive: false });

        // Collected steps navigation
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
        
        // History API support
        globalThis.addEventListener('popstate', () => {
            this.#handleHistoryNavigation();
        });
        
        // Mouse position tracking for cursor arrow (only when hero is visible)
        document.addEventListener('mousemove', (e) => {
            if (this.#currentSectionIndex === -1) {
                this.#cursorArrow?.updateMousePosition(e.clientX, e.clientY);
            }
        });

        // Hide cursor arrow when appropriate
        document.addEventListener('mouseleave', () => this.#cursorArrow?.stop());
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.#cursorArrow?.stop();
            }
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

        // Only add touchmove for hero to prevent default scrolling
        if (element === this.#hero) {
            element.addEventListener('touchmove', (e) => {
                if (!this.#isFromScrollableElement(e.target)) {
                    e.preventDefault();
                }
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
        // If we're on hero, always use page navigation
        if (this.#currentSectionIndex === -1) {
            return false;
        }

        // Get the current section element and its container
        const currentSection = this.#sections[this.#currentSectionIndex];
        if (!currentSection?.classList.contains('visible')) {
            return false;
        }

        // Find the scrollable container within the section
        const container = currentSection.querySelector('.container');
        if (!container) {
            return false;
        }

        // Check if the container has scrollable content
        const { scrollTop, scrollHeight, clientHeight } = container;
        
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
            return scrollTop >= 1;
        }
    }

    /**
     * Unified decision logic for wheel/touch navigation vs. scrolling
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
     */
    #goToSection(sectionIndex) {
        if (this.#isTransitioning || sectionIndex === this.#currentSectionIndex) return;
        
        this.#isTransitioning = true;
        
        // Stop cursor arrow when leaving hero section
        if (this.#currentSectionIndex === -1 && sectionIndex !== -1) {
            this.#cursorArrow?.stop();
        }
        
        // Hide current section/hero
        if (this.#currentSectionIndex === -1) {
            this.#hero?.classList.remove('visible');
        } else {
            const currentSection = this.#sections[this.#currentSectionIndex];
            currentSection?.classList.remove('visible', 'active');
        }

        // Update history API
        this.#updateHistory(sectionIndex);

        // Show target section/hero
        setTimeout(() => {
            if (sectionIndex === -1) {
                this.#hero?.classList.add('visible');
            } else {
                const targetSection = this.#sections[sectionIndex];
                if (targetSection) {
                    targetSection.classList.add('visible', 'active');
                    
                    // Collect step if not already collected
                    const stepId = targetSection.getAttribute('data-step');
                    const title = this.#stepTitles[stepId] || `Step ${stepId}`;
                    this.#collectStep(stepId, title, sectionIndex);
                    
                    // Mark section as collected
                    targetSection.classList.add('collected');
                    
                    // Reset scroll position
                    const container = targetSection.querySelector('.container');
                    if (container) {
                        container.scrollTop = 0;
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
     * Setup History API for deep linking and browser navigation
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
     * Render section immediately without animation (for initial page load)
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
                this.#hero?.classList.add('visible');
            } else if (sectionIndex >= 0 && sectionIndex < this.#sections.length) {
                const targetSection = this.#sections[sectionIndex];
                targetSection.classList.add('visible', 'active');
                
                // Collect previous steps
                for (let i = 0; i <= sectionIndex; i++) {
                    const section = this.#sections[i];
                    const stepId = section.getAttribute('data-step');
                    const title = this.#stepTitles[stepId] || `Step ${stepId}`;
                    this.#collectStep(stepId, title, i);
                    section.classList.add('collected');
                }
            }

            this.#currentSectionIndex = sectionIndex;
            this.#updateProgressBar();
            
        } catch (err) {
            error('Failed to render section immediately:', err);
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

            // Add step with animation
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
     */
    #highlightElement(element) {
        try {
            element.classList.add('highlight', 'has-hover-effects');
            
            // Remove highlight after animation
            setTimeout(() => {
                element.classList.remove('highlight');
            }, this.#timings.highlight);
            
        } catch (err) {
            error('Failed to highlight element:', err);
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
            const totalSteps = stepSections.length;

            // Calculate current step number
            let currentStepNumber = 0; // 0 = Hero/Intro
            if (this.#currentSectionIndex >= 0) {
                const active = this.#sections[this.#currentSectionIndex];
                const id = active?.dataset?.step ?? null;
                if (id && id !== 'intro') {
                    currentStepNumber = parseInt(id) || 0;
                }
            }

            // Progress: 0% on hero/intro, 100% on step 5
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
     * Initialize the application
     */
    #initialize() {
        this.#updateProgressBar();
        this.#videoManager = new VideoManager('.showcase-video');
        
        log('Fedora GNOME installer website loaded with modern JavaScript!');
    }

    /**
     * Generate scroll indicators from template to eliminate duplication
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

        scrollIndicatorData.forEach(data => {
            const container = document.querySelector(data.container);
            if (!container) return;

            // Check if scroll indicator already exists
            if (container.querySelector('.scroll-indicator')) return;

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

        // Create scroll arrow
        const scrollArrow = document.createElement('div');
        scrollArrow.className = 'scroll-arrow';
        scrollArrow.setAttribute('aria-hidden', 'true');

        // Create screen reader text
        const srText = document.createElement('span');
        srText.className = 'sr-only';
        srText.textContent = nextText;

        button.append(scrollArrow, srText);

        return button;
    }

    /**
     * Cleanup method for removing event listeners and resources
     */
    destroy() {
        try {
            // Stop cursor arrow
            this.#cursorArrow?.stop();
            
            // Remove toast if it exists
            document.querySelector('.toast')?.remove();

            // Clear references to DOM elements
            this.#progressEl = null;
            this.#collectedSteps = null;
            this.#sections = null;
            this.#hero = null;
            this.#cursorArrow = null;
            this.#videoManager = null;
            
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
            globalThis.addEventListener('beforeunload', () => {
                this.destroy();
            });

            // Clean up on page visibility change (when tab is closed/hidden)
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    this.#cursorArrow?.stop();
                }
            });

            log('Destroy method wired up to lifecycle events');
        } catch (err) {
            error('Failed to wire up destroy method:', err);
        }
    }
}

/**
 * Progressive enhancement utilities
 */
class ProgressiveEnhancements {
    static initialize() {
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
                this.showCopyFeedback(btn, false);
                return;
            }
            
            // Modern clipboard API with fallback
            if (navigator.clipboard?.writeText) {
                navigator.clipboard.writeText(text)
                    .then(() => this.showCopyFeedback(btn, true))
                    .catch((error) => {
                        warn('Clipboard API failed, falling back:', error);
                        this.fallbackCopyText(text, btn);
                    });
            } else {
                this.fallbackCopyText(text, btn);
            }
        });
        
        // Smooth skip-link focus handling for accessibility
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                const targetId = anchor.getAttribute('href').slice(1);
                const targetElement = targetId ? document.getElementById(targetId) : null;
                
                if (targetElement) {
                    e.preventDefault();
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    targetElement.focus({ preventScroll: true });
                }
            });
        });
        
        log('Progressive enhancement features initialized');
    }
    
    /**
     * Show visual feedback when text is copied
     */
    static showCopyFeedback(button, success = true) {
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
        
        // Reset button after delay
        setTimeout(() => {
            button.textContent = originalText;
            button.setAttribute('aria-label', originalAriaLabel);
            button.classList.remove('copy-ok', 'copy-fail');
        }, CSSTimings.instance.copyFeedback);
    }
    
    /**
     * Fallback copy method for browsers without clipboard API
     */
    static fallbackCopyText(text, button) {
        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.className = 'copy-helper-textarea';
            
            document.body.appendChild(textarea);
            textarea.select();
            textarea.setSelectionRange(0, 99999);
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textarea);
            
            this.showCopyFeedback(button, successful);
            
            if (!successful) {
                warn('Document.execCommand copy failed');
            }
            
        } catch (err) {
            error('Fallback copy failed:', err);
            this.showCopyFeedback(button, false);
        }
    }
}

/**
 * Global error handling and toast notifications
 */
class ErrorHandling {
    /**
     * Show error toast notification
     */
    static showErrorToast(message) {
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
        
        toast.textContent = message;
        toast.classList.remove('toast-success');
        toast.classList.add('toast-error');
        toast.removeAttribute('hidden');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            toast.setAttribute('hidden', '');
        }, CSSTimings.instance.toastDuration);
    }
    
    /**
     * Setup global error handlers
     */
    static setupGlobalHandlers() {
        // Unhandled promise rejections
        globalThis.addEventListener('unhandledrejection', (event) => {
            error('Unhandled promise rejection:', event.reason);
            this.showErrorToast('Something went wrong. Please try again.');
            
            // Prevent the default console error
            event.preventDefault();
        });
        
        // Global JavaScript errors
        globalThis.addEventListener('error', (event) => {
            error('Global JavaScript error:', event.error);
            this.showErrorToast('An unexpected error occurred. Please refresh the page.');
        });
    }
}

// Global function for backward compatibility
globalThis.showErrorToast = ErrorHandling.showErrorToast.bind(ErrorHandling);

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Feature detection for required APIs
        if (!('requestAnimationFrame' in globalThis)) {
            throw new Error('RequestAnimationFrame not supported');
        }

        // Setup global error handling
        ErrorHandling.setupGlobalHandlers();

        // Initialize progressive enhancements
        ProgressiveEnhancements.initialize();

        // Initialize the main application
        const installerUI = new FedoraInstallerUI();
        
        // Store reference for potential cleanup
        globalThis.installerUI = installerUI;
        
    } catch (err) {
        error('Failed to initialize Fedora Installer UI:', err);
        ErrorHandling.showErrorToast('Something went wrong loading the page. Please refresh and try again.');
    }
});