/**
 * Smooth scrolling and step collection functionality for Fedora GNOME installer website
 * @author Cadric
 * @description Provides interactive scrolling, step collection, and navigation features
 */

/**
 * Main application class for handling website interactions
 */
class FedoraInstallerUI {
    // Private fields
    #progressFill;
    #collectedSteps;
    #sections;
    #hero;
    #ticking = false;
    #scrollIndicatorTimeout = null;
    #sectionObserver;
    
    // Step titles mapping for collection
    #stepTitles = {
        'intro': 'Introduction',
        '1': 'Download Fedora',
        '2': 'Login as Root', 
        '3': 'Run Script',
        '4': 'Configure',
        '5': 'Complete'
    };

    constructor() {
        this.#initializeElements();
        this.#setupObservers();
        this.#bindEvents();
        this.#initialize();
    }

    /**
     * Initialize DOM elements with error handling
     */
    #initializeElements() {
        try {
            this.#progressFill = document.querySelector('.progress-fill');
            this.#collectedSteps = document.querySelector('.collected-steps');
            this.#sections = document.querySelectorAll('.section[data-step]');
            this.#hero = document.querySelector('.hero');

            if (!this.#progressFill || !this.#collectedSteps || !this.#hero) {
                throw new Error('Required DOM elements not found');
            }
        } catch (error) {
            console.error('Failed to initialize DOM elements:', error);
            throw error;
        }
    }

    /**
     * Setup Intersection Observer for sections
     */
    #setupObservers() {
        const observerOptions = {
            root: null,
            rootMargin: '-20% 0px -20% 0px',
            threshold: 0
        };

        this.#sectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Make section visible with animation
                    entry.target.classList.add('visible');
                    
                    // Collect step at top if it has a data-step attribute
                    const stepId = entry.target.getAttribute('data-step');
                    if (stepId && this.#stepTitles[stepId]) {
                        this.#collectStep(stepId, this.#stepTitles[stepId]);
                    }
                }
            });
        }, observerOptions);

        // Observe all sections
        this.#sections.forEach(section => {
            this.#sectionObserver.observe(section);
        });
    }

    /**
     * Collect step function with enhanced error handling
     * @param {string} stepId - The step identifier
     * @param {string} title - The step title
     */
    #collectStep(stepId, title) {
        try {
            // Check if step is already collected
            if (document.querySelector(`[data-collected-step="${stepId}"]`)) {
                return;
            }
            
            // Create collected step element
            const stepElement = document.createElement('div');
            stepElement.className = 'collected-step';
            stepElement.setAttribute('data-collected-step', stepId);
            stepElement.textContent = title;
            stepElement.style.cursor = 'pointer';
            stepElement.title = `Go back to: ${title}`;
            
            // Add click handler to scroll back to the section
            stepElement.addEventListener('click', () => {
                this.#scrollToSection(stepId, title);
            });
            
            // Add hover effects
            this.#addHoverEffects(stepElement);
            
            // Add to collected steps container
            this.#collectedSteps.appendChild(stepElement);
        } catch (error) {
            console.error(`Failed to collect step ${stepId}:`, error);
        }
    }

    /**
     * Scroll to a specific section with highlight effect
     * @param {string} stepId - The step identifier
     * @param {string} title - The step title for logging
     */
    #scrollToSection(stepId, title) {
        try {
            const targetSection = document.querySelector(`[data-step="${stepId}"]`);
            if (!targetSection) {
                console.warn(`Section with step ID "${stepId}" not found`);
                return;
            }

            targetSection.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
            
            // Add temporary highlight effect
            this.#highlightElement(targetSection);
        } catch (error) {
            console.error(`Failed to scroll to section ${stepId}:`, error);
        }
    }

    /**
     * Add temporary highlight effect to an element
     * @param {Element} element - The element to highlight
     */
    #highlightElement(element) {
        element.style.transform = 'scale(1.02)';
        element.style.transition = 'transform 0.3s ease';
        
        setTimeout(() => {
            element.style.transform = 'scale(1)';
            setTimeout(() => {
                element.style.transition = '';
            }, 300);
        }, 300);
    }

    /**
     * Add hover effects to an element
     * @param {Element} element - The element to add effects to
     */
    #addHoverEffects(element) {
        element.addEventListener('mouseenter', () => {
            element.style.transform = 'translateY(-2px)';
            element.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
        });
        
        element.addEventListener('mouseleave', () => {
            element.style.transform = 'translateY(0)';
            element.style.boxShadow = 'none';
        });
    }

    /**
     * Update progress bar based on scroll position
     */
    #updateProgressBar() {
        try {
            const windowHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            
            // Calculate progress (excluding hero section)
            const heroHeight = this.#hero.offsetHeight;
            const contentHeight = documentHeight - heroHeight - windowHeight;
            const contentScrolled = Math.max(0, scrollTop - heroHeight);
            
            const progress = Math.min(100, (contentScrolled / contentHeight) * 100);
            this.#progressFill.style.width = `${progress}%`;
        } catch (error) {
            console.error('Failed to update progress bar:', error);
        }
    }

    /**
     * Throttled scroll handler
     */
    #onScroll = () => {
        if (!this.#ticking) {
            requestAnimationFrame(() => {
                this.#updateProgressBar();
                this.#updateParallax();
                this.#ticking = false;
            });
            this.#ticking = true;
        }
    };

    /**
     * Setup main scroll indicator functionality
     */
    #setupMainScrollIndicator() {
        const scrollIndicator = document.querySelector('.scroll-indicator');
        if (!scrollIndicator) return;

        scrollIndicator.addEventListener('click', () => {
            const firstSection = document.querySelector('.intro-section');
            if (firstSection) {
                firstSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });

        // Add hover effects
        Object.assign(scrollIndicator.style, {
            cursor: 'pointer',
            transition: 'transform 0.3s ease, opacity 0.3s ease'
        });

        scrollIndicator.addEventListener('mouseenter', () => {
            Object.assign(scrollIndicator.style, {
                transform: 'scale(1.1)',
                opacity: '1'
            });
        });

        scrollIndicator.addEventListener('mouseleave', () => {
            Object.assign(scrollIndicator.style, {
                transform: 'scale(1)',
                opacity: '0.7'
            });
        });

        // Auto-hide functionality
        window.addEventListener('scroll', () => {
            const scrolled = window.pageYOffset;
            if (scrolled > 100) {
                Object.assign(scrollIndicator.style, {
                    opacity: '0',
                    pointerEvents: 'none'
                });
            } else {
                clearTimeout(this.#scrollIndicatorTimeout);
                Object.assign(scrollIndicator.style, {
                    opacity: '0.7',
                    pointerEvents: 'auto'
                });
                
                // Auto-hide after delay when at top
                this.#scrollIndicatorTimeout = setTimeout(() => {
                    if (window.pageYOffset <= 100) {
                        scrollIndicator.style.opacity = '0.5';
                    }
                }, 3000);
            }
        });
    }

    /**
     * Setup step scroll indicators
     */
    #setupStepScrollIndicators() {
        const stepScrollIndicators = document.querySelectorAll('.step-scroll-indicator');
        
        stepScrollIndicators.forEach((indicator, index) => {
            indicator.addEventListener('click', () => {
                this.#handleStepIndicatorClick(index);
            });

            // Add hover tooltip
            indicator.title = index === stepScrollIndicators.length - 1 
                ? 'Scroll to bottom' 
                : 'Continue to next step';
        });
    }

    /**
     * Handle step indicator click
     * @param {number} index - The index of the clicked indicator
     */
    #handleStepIndicatorClick(index) {
        try {
            const allSections = Array.from(this.#sections);
            const nextSection = allSections[index + 1];
            
            if (nextSection) {
                nextSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            } else {
                // If it's the last step, scroll to footer
                const footer = document.querySelector('.footer');
                footer?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        } catch (error) {
            console.error(`Failed to handle step indicator click for index ${index}:`, error);
        }
    }

    /**
     * Setup copy functionality for code blocks
     */
    #setupCodeBlockCopy() {
        document.querySelectorAll('.code-block').forEach(codeBlock => {
            // Skip if it contains a link
            if (codeBlock.querySelector('a')) return;
            
            this.#addCopyButton(codeBlock);
        });
    }

    /**
     * Add copy button to code block
     * @param {Element} codeBlock - The code block element
     */
    #addCopyButton(codeBlock) {
        try {
            const copyButton = document.createElement('button');
            copyButton.className = 'copy-button';
            copyButton.innerHTML = '📋';
            copyButton.title = 'Copy to clipboard';
            
            Object.assign(copyButton.style, {
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'rgba(59, 130, 246, 0.2)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '6px',
                padding: '8px',
                color: '#60a5fa',
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'all 0.3s ease'
            });
            
            // Add hover effects
            copyButton.addEventListener('mouseenter', () => {
                Object.assign(copyButton.style, {
                    background: 'rgba(59, 130, 246, 0.3)',
                    transform: 'scale(1.1)'
                });
            });
            
            copyButton.addEventListener('mouseleave', () => {
                Object.assign(copyButton.style, {
                    background: 'rgba(59, 130, 246, 0.2)',
                    transform: 'scale(1)'
                });
            });
            
            // Add click handler
            copyButton.addEventListener('click', async () => {
                await this.#copyToClipboard(codeBlock, copyButton);
            });
            
            codeBlock.style.position = 'relative';
            codeBlock.appendChild(copyButton);
        } catch (error) {
            console.error('Failed to add copy button:', error);
        }
    }

    /**
     * Copy text to clipboard with fallback
     * @param {Element} codeBlock - The code block element
     * @param {Element} copyButton - The copy button element
     */
    async #copyToClipboard(codeBlock, copyButton) {
        try {
            const code = codeBlock.querySelector('code');
            const text = code?.textContent || codeBlock.textContent;
            
            if ('clipboard' in navigator) {
                await navigator.clipboard.writeText(text);
            } else {
                // Fallback for older browsers
                this.#fallbackCopyToClipboard(text);
            }
            
            // Visual feedback
            this.#showCopySuccess(copyButton);
            
        } catch (error) {
            console.warn('Failed to copy text:', error);
            // Try fallback even if modern method fails
            const code = codeBlock.querySelector('code');
            const text = code?.textContent || codeBlock.textContent;
            this.#fallbackCopyToClipboard(text);
            this.#showCopySuccess(copyButton);
        }
    }

    /**
     * Fallback copy method for older browsers
     * @param {string} text - Text to copy
     */
    #fallbackCopyToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
    }

    /**
     * Show copy success feedback
     * @param {Element} copyButton - The copy button element
     */
    #showCopySuccess(copyButton) {
        const originalContent = copyButton.innerHTML;
        const originalColor = copyButton.style.color;
        
        copyButton.innerHTML = '✅';
        copyButton.style.color = '#10b981';
        
        setTimeout(() => {
            copyButton.innerHTML = originalContent;
            copyButton.style.color = originalColor;
        }, 2000);
    }

    /**
     * Update parallax effect for hero section
     */
    #updateParallax() {
        try {
            const scrolled = window.pageYOffset;
            const heroContent = document.querySelector('.hero-content');
            
            if (heroContent && scrolled < window.innerHeight) {
                const parallaxValue = scrolled * 0.3;
                heroContent.style.transform = `translateY(${parallaxValue}px)`;
                heroContent.style.opacity = 1 - (scrolled / window.innerHeight);
            }
        } catch (error) {
            console.error('Failed to update parallax:', error);
        }
    }

    /**
     * Setup keyboard navigation
     */
    #setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            try {
                if (e.key === 'ArrowDown' || e.key === ' ') {
                    e.preventDefault();
                    const currentSection = this.#getCurrentSection();
                    const nextSection = this.#getNextSection(currentSection);
                    if (nextSection) {
                        nextSection.scrollIntoView({ behavior: 'smooth' });
                    }
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const currentSection = this.#getCurrentSection();
                    const prevSection = this.#getPreviousSection(currentSection);
                    if (prevSection) {
                        prevSection.scrollIntoView({ behavior: 'smooth' });
                    } else {
                        this.#hero.scrollIntoView({ behavior: 'smooth' });
                    }
                }
            } catch (error) {
                console.error('Keyboard navigation error:', error);
            }
        });
    }

    /**
     * Get current section based on scroll position
     * @returns {Element|null} Current section element
     */
    #getCurrentSection() {
        const scrollPosition = window.pageYOffset + window.innerHeight / 2;
        for (let i = this.#sections.length - 1; i >= 0; i--) {
            if (this.#sections[i].offsetTop <= scrollPosition) {
                return this.#sections[i];
            }
        }
        return null;
    }

    /**
     * Get next section
     * @param {Element|null} currentSection - Current section element
     * @returns {Element|null} Next section element
     */
    #getNextSection(currentSection) {
        if (!currentSection) return this.#sections[0] || null;
        const currentIndex = Array.from(this.#sections).indexOf(currentSection);
        return this.#sections[currentIndex + 1] || null;
    }

    /**
     * Get previous section
     * @param {Element|null} currentSection - Current section element
     * @returns {Element|null} Previous section element
     */
    #getPreviousSection(currentSection) {
        if (!currentSection) return null;
        const currentIndex = Array.from(this.#sections).indexOf(currentSection);
        return this.#sections[currentIndex - 1] || null;
    }

    /**
     * Setup smooth scroll for anchor links
     */
    #setupAnchorLinks() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector(anchor.getAttribute('href'));
                target?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            });
        });
    }

    /**
     * Apply performance optimizations
     */
    #applyPerformanceOptimizations() {
        // Reduce animations on low-end devices
        if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) {
            document.documentElement.style.setProperty('--animation-duration', '0.3s');
        }
    }

    /**
     * Bind all event listeners
     */
    #bindEvents() {
        window.addEventListener('scroll', this.#onScroll);
        this.#setupMainScrollIndicator();
        this.#setupStepScrollIndicators();
        this.#setupCodeBlockCopy();
        this.#setupKeyboardNavigation();
        this.#setupAnchorLinks();
    }

    /**
     * Initialize the application
     */
    #initialize() {
        this.#updateProgressBar();
        this.#updateParallax();
        this.#applyPerformanceOptimizations();
        this.#initializeShowcaseVideo();
        console.log('✨ Fedora GNOME installer website loaded successfully!');
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
                console.log('📺 Showcase video loaded successfully');
            };

            // Handle load events
            if (video.readyState >= 3) {
                // Video already loaded
                handleVideoLoad();
            } else {
                video.addEventListener('loadeddata', handleVideoLoad, { once: true });
                video.addEventListener('canplaythrough', handleVideoLoad, { once: true });
            }

            // Error handling
            video.addEventListener('error', (error) => {
                console.error('Video failed to load:', error);
                this.#handleVideoError(video);
            }, { once: true });

            // Initialize video controls
            this.#initializeVideoControls(video);

            // Intersection observer for performance optimization
            const videoObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        // Video is visible, ensure it's playing
                        this.#ensureVideoPlaying(video);
                    } else {
                        // Video is not visible, pause to save resources
                        video.pause();
                        this.#updatePlayPauseButton(false);
                    }
                });
            }, {
                threshold: 0.25,
                rootMargin: '50px'
            });

            videoObserver.observe(video);

            // Handle user interaction preferences
            this.#respectUserPreferences(video);

        } catch (error) {
            console.error('Failed to initialize showcase video:', error);
            this.#handleVideoError(video);
        }
    }

    /**
     * Initialize custom video controls
     * @param {HTMLVideoElement} video 
     */
    #initializeVideoControls(video) {
        const playPauseBtn = document.getElementById('play-pause-btn');
        const muteBtn = document.getElementById('mute-btn');

        if (!playPauseBtn || !muteBtn) return;

        // Play/Pause functionality
        playPauseBtn.addEventListener('click', () => {
            if (video.paused) {
                video.play().catch(error => {
                    console.log('Play failed:', error.name);
                });
            } else {
                video.pause();
            }
        });

        // Mute/Unmute functionality
        muteBtn.addEventListener('click', () => {
            video.muted = !video.muted;
            this.#updateMuteButton(video.muted);
        });

        // Update button states when video state changes
        video.addEventListener('play', () => this.#updatePlayPauseButton(true));
        video.addEventListener('pause', () => this.#updatePlayPauseButton(false));
        video.addEventListener('volumechange', () => this.#updateMuteButton(video.muted));

        // Keyboard accessibility
        video.addEventListener('keydown', (e) => {
            switch(e.code) {
                case 'Space':
                    e.preventDefault();
                    playPauseBtn.click();
                    break;
                case 'KeyM':
                    e.preventDefault();
                    muteBtn.click();
                    break;
            }
        });

        // Initialize button states
        this.#updatePlayPauseButton(!video.paused);
        this.#updateMuteButton(video.muted);
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
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
            playPauseBtn.setAttribute('aria-label', 'Pause video');
        } else {
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
            playPauseBtn.setAttribute('aria-label', 'Play video');
        }
    }

    /**
     * Update mute button appearance
     * @param {boolean} isMuted 
     */
    #updateMuteButton(isMuted) {
        const muteBtn = document.getElementById('mute-btn');
        if (!muteBtn) return;

        const volumeIcon = muteBtn.querySelector('.volume-icon');
        const mutedIcon = muteBtn.querySelector('.muted-icon');

        if (isMuted) {
            volumeIcon.style.display = 'none';
            mutedIcon.style.display = 'block';
            muteBtn.setAttribute('aria-label', 'Unmute video');
        } else {
            volumeIcon.style.display = 'block';
            mutedIcon.style.display = 'none';
            muteBtn.setAttribute('aria-label', 'Mute video');
        }
    }

    /**
     * Ensure video is playing when visible
     * @param {HTMLVideoElement} video 
     */
    #ensureVideoPlaying(video) {
        if (video.paused && video.readyState >= 3) {
            const playPromise = video.play();
            
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        // Video started playing successfully
                    })
                    .catch(error => {
                        // Auto-play was prevented, which is fine
                        console.log('Video autoplay prevented (user preference):', error.name);
                    });
            }
        }
    }

    /**
     * Respect user preferences for motion and data usage
     * @param {HTMLVideoElement} video 
     */
    #respectUserPreferences(video) {
        // Respect prefers-reduced-motion
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
            video.pause();
            video.removeAttribute('autoplay');
            console.log('🎬 Video autoplay disabled due to user motion preferences');
        }

        // Respect data saver preferences (if supported)
        if (navigator.connection?.saveData) {
            video.preload = 'none';
            video.pause();
            video.removeAttribute('autoplay');
            console.log('📡 Video preload disabled due to data saver preference');
            
            // Add a play button overlay for data saver users
            this.#addVideoPlayButton(video);
        }
    }

    /**
     * Add a manual play button for users with data constraints
     * @param {HTMLVideoElement} video 
     */
    #addVideoPlayButton(video) {
        const playButton = document.createElement('button');
        playButton.innerHTML = `
            <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z"/>
            </svg>
            <span>Play Installation Demo</span>
        `;
        playButton.className = 'video-play-button';
        playButton.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(59, 130, 246, 0.9);
            color: white;
            border: none;
            border-radius: 12px;
            padding: 16px 24px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 12px;
            transition: all 0.2s ease;
            backdrop-filter: blur(8px);
            z-index: 10;
        `;

        // Add hover effect
        playButton.addEventListener('mouseenter', () => {
            playButton.style.transform = 'translate(-50%, -50%) scale(1.05)';
            playButton.style.background = 'rgba(59, 130, 246, 1)';
        });

        playButton.addEventListener('mouseleave', () => {
            playButton.style.transform = 'translate(-50%, -50%) scale(1)';
            playButton.style.background = 'rgba(59, 130, 246, 0.9)';
        });

        // Handle click
        playButton.addEventListener('click', () => {
            video.play();
            playButton.remove();
        });

        // Add button to video container
        const videoContainer = video.closest('.video-showcase');
        if (videoContainer) {
            videoContainer.style.position = 'relative';
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

        // Create fallback content
        const fallback = document.createElement('div');
        fallback.className = 'video-fallback';
        fallback.innerHTML = `
            <div class="video-fallback-content">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" opacity="0.5">
                    <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z"/>
                </svg>
                <h3>Installation Demo</h3>
                <p>Experience the smooth, automated Fedora GNOME installation process.</p>
                <a href="https://ifg.sh/showcase.mp4" target="_blank" rel="noopener noreferrer" class="fallback-link">
                    View Demo Video →
                </a>
            </div>
        `;

        fallback.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 300px;
            background: var(--color-bg-secondary);
            border-radius: var(--radius-lg);
            text-align: center;
            color: var(--color-text-secondary);
        `;

        // Replace video with fallback
        video.replaceWith(fallback);
    }

    /**
     * Cleanup method for removing event listeners
     */
    destroy() {
        try {
            window.removeEventListener('scroll', this.#onScroll);
            this.#sectionObserver?.disconnect();
            clearTimeout(this.#scrollIndicatorTimeout);
        } catch (error) {
            console.error('Failed to cleanup FedoraInstallerUI:', error);
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Feature detection for required APIs
        if (!('IntersectionObserver' in window)) {
            console.warn('IntersectionObserver not supported. Some features may not work.');
            return;
        }

        // Initialize the main application
        const installerUI = new FedoraInstallerUI();
        
        // Store reference for potential cleanup
        window.installerUI = installerUI;
        
    } catch (error) {
        console.error('Failed to initialize Fedora Installer UI:', error);
        // Provide user-friendly error message
        const errorDiv = document.createElement('div');
        errorDiv.textContent = 'Something went wrong loading the page. Please refresh and try again.';
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ef4444;
            color: white;
            padding: 10px 20px;
            border-radius: 8px;
            z-index: 9999;
            font-family: system-ui, sans-serif;
        `;
        document.body.appendChild(errorDiv);
        
        // Auto-remove error message after 5 seconds
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
});
