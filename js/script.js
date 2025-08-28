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
        console.log('✨ Fedora GNOME installer website loaded successfully!');
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
