/**
 * Page transition and step collection functionality for Fedora GNOME installer website
 * @author Cadric
 * @description Provides page transitions, step collection, and navigation features
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
    #currentSectionIndex = -1; // Start with hero (-1), then sections (0, 1, 2...)
    #isTransitioning = false;
    #touchStartY = 0;
    #touchStartX = 0;
    #scrollIndicatorTimeout = null;
    
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
        this.#setupPageTransitions();
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

            // Hide all sections initially except hero
            this.#sections.forEach(section => {
                section.classList.remove('visible', 'active');
            });

        } catch (error) {
            console.error('Failed to initialize DOM elements:', error);
            throw error;
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

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
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
            }
        });

        // Touch/swipe events
        document.addEventListener('touchstart', (e) => {
            this.#touchStartY = e.touches[0].clientY;
            this.#touchStartX = e.touches[0].clientX;
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            // Prevent default scrolling
            e.preventDefault();
        }, { passive: false });

        document.addEventListener('touchend', (e) => {
            if (this.#isTransitioning) return;

            const touchEndY = e.changedTouches[0].clientY;
            const touchEndX = e.changedTouches[0].clientX;
            const deltaY = this.#touchStartY - touchEndY;
            const deltaX = Math.abs(this.#touchStartX - touchEndX);

            // Only trigger if vertical swipe is dominant
            if (Math.abs(deltaY) > 50 && deltaX < 100) {
                if (deltaY > 0) {
                    // Swipe up - go to next section
                    this.#goToNextSection();
                } else {
                    // Swipe down - go to previous section
                    this.#goToPreviousSection();
                }
            }
        }, { passive: true });

        // Mouse wheel navigation
        document.addEventListener('wheel', (e) => {
            if (this.#isTransitioning) return;
            
            e.preventDefault();
            
            if (e.deltaY > 0) {
                // Scroll down - go to next section
                this.#goToNextSection();
            } else {
                // Scroll up - go to previous section
                this.#goToPreviousSection();
            }
        }, { passive: false });

        // Collected steps navigation
        document.addEventListener('click', (e) => {
            if (e.target.closest('.collected-step')) {
                const stepElement = e.target.closest('.collected-step');
                const stepIndex = parseInt(stepElement.dataset.stepIndex);
                if (!isNaN(stepIndex)) {
                    this.#goToSection(stepIndex);
                }
            }
        });
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
                        this.#collectStep(stepId, this.#stepTitles[stepId]);
                    }
                }
            }
            
            this.#currentSectionIndex = sectionIndex;
            this.#updateProgressBar();
            
            // Allow next transition after animation
            setTimeout(() => {
                this.#isTransitioning = false;
            }, 300);
        }, 100);
    }

    /**
     * Collect step function with enhanced error handling
     * @param {string} stepId - The step identifier
     * @param {string} title - The step title
     */
    #collectStep(stepId, title) {
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
            stepElement.setAttribute('data-step-index', this.#currentSectionIndex);
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
            stepElement.style.opacity = '0';
            stepElement.style.transform = 'translateX(-20px)';
            this.#collectedSteps.appendChild(stepElement);

            // Animate in
            requestAnimationFrame(() => {
                stepElement.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                stepElement.style.opacity = '1';
                stepElement.style.transform = 'translateX(0)';
            });

            // Highlight the new step
            setTimeout(() => this.#highlightElement(stepElement), 100);

        } catch (error) {
            console.error('Failed to collect step:', error);
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
            }, 1000);
            
            // Add hover effects
            this.#addHoverEffects(element);
            
        } catch (error) {
            console.error('Failed to highlight element:', error);
        }
    }

    /**
     * Add hover effects to collected steps
     * @param {HTMLElement} element - Element to add effects to
     */
    #addHoverEffects(element) {
        try {
            element.addEventListener('mouseenter', () => {
                element.style.transform = 'translateY(-2px) scale(1.05)';
            });
            
            element.addEventListener('mouseleave', () => {
                element.style.transform = 'translateY(0) scale(1)';
            });
        } catch (error) {
            console.error('Failed to add hover effects:', error);
        }
    }

    /**
     * Update progress bar based on current section
     */
    #updateProgressBar() {
        try {
            // Calculate progress: -1 (hero) = 0%, sections 0 to n-1 = distributed
            const totalSteps = this.#sections.length + 1; // +1 for hero
            const currentStep = this.#currentSectionIndex + 2; // +2 to account for hero at -1
            const progress = Math.min((currentStep / totalSteps) * 100, 100);

            if (this.#progressFill) {
                this.#progressFill.style.width = `${progress}%`;
                
                // Update ARIA attributes
                const progressBar = this.#progressFill.closest('.progress-bar');
                if (progressBar) {
                    progressBar.setAttribute('aria-valuenow', Math.round(progress));
                }
            }
        } catch (error) {
            console.error('Failed to update progress bar:', error);
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
     * Initialize the application
     */
    #initialize() {
        this.#updateProgressBar();
        this.#initializeShowcaseVideo();
        console.log('✨ Fedora GNOME installer website loaded with page transitions!');
    }

    /**
     * Cleanup method for removing event listeners
     */
    destroy() {
        try {
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
        if (!('requestAnimationFrame' in window)) {
            console.warn('requestAnimationFrame not supported. Some features may not work.');
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
