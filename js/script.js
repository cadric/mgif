// Smooth scrolling and step collection functionality
document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const progressFill = document.querySelector('.progress-fill');
    const collectedSteps = document.querySelector('.collected-steps');
    const sections = document.querySelectorAll('.section[data-step]');
    const hero = document.querySelector('.hero');
    
    // Step titles for collection
    const stepTitles = {
        'intro': 'Introduction',
        '1': 'Download Fedora',
        '2': 'Login as Root', 
        '3': 'Run Script',
        '4': 'Configure',
        '5': 'Complete'
    };
    
    // Intersection Observer for sections
    const observerOptions = {
        root: null,
        rootMargin: '-20% 0px -20% 0px',
        threshold: 0
    };
    
    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Make section visible with animation
                entry.target.classList.add('visible');
                
                // Collect step at top if it has a data-step attribute
                const stepId = entry.target.getAttribute('data-step');
                if (stepId && stepTitles[stepId]) {
                    collectStep(stepId, stepTitles[stepId]);
                }
            }
        });
    }, observerOptions);
    
    // Observe all sections
    sections.forEach(section => {
        sectionObserver.observe(section);
    });
    
    // Collect step function
    function collectStep(stepId, title) {
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
            const targetSection = document.querySelector(`[data-step="${stepId}"]`);
            if (targetSection) {
                targetSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
                
                // Add temporary highlight effect
                targetSection.style.transform = 'scale(1.02)';
                targetSection.style.transition = 'transform 0.3s ease';
                setTimeout(() => {
                    targetSection.style.transform = 'scale(1)';
                    setTimeout(() => {
                        targetSection.style.transition = '';
                    }, 300);
                }, 300);
            }
        });
        
        // Add hover effects
        stepElement.addEventListener('mouseenter', () => {
            stepElement.style.transform = 'translateY(-2px)';
            stepElement.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
        });
        
        stepElement.addEventListener('mouseleave', () => {
            stepElement.style.transform = 'translateY(0)';
            stepElement.style.boxShadow = 'none';
        });
        
        // Add to collected steps container
        collectedSteps.appendChild(stepElement);
    }
    
    // Progress bar update on scroll
    function updateProgressBar() {
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // Calculate progress (excluding hero section)
        const heroHeight = hero.offsetHeight;
        const contentHeight = documentHeight - heroHeight - windowHeight;
        const contentScrolled = Math.max(0, scrollTop - heroHeight);
        
        const progress = Math.min(100, (contentScrolled / contentHeight) * 100);
        progressFill.style.width = progress + '%';
    }
    
    // Scroll event listener with throttling
    let ticking = false;
    function onScroll() {
        if (!ticking) {
            requestAnimationFrame(() => {
                updateProgressBar();
                ticking = false;
            });
            ticking = true;
        }
    }
    
    window.addEventListener('scroll', onScroll);
    
    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Interactive scroll indicator
    const scrollIndicator = document.querySelector('.scroll-indicator');
    if (scrollIndicator) {
        scrollIndicator.addEventListener('click', () => {
            // Find the first section (intro section)
            const firstSection = document.querySelector('.intro-section');
            if (firstSection) {
                firstSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });

        // Add cursor pointer and hover effects
        scrollIndicator.style.cursor = 'pointer';
        scrollIndicator.style.transition = 'transform 0.3s ease, opacity 0.3s ease';

        scrollIndicator.addEventListener('mouseenter', () => {
            scrollIndicator.style.transform = 'scale(1.1)';
            scrollIndicator.style.opacity = '1';
        });

        scrollIndicator.addEventListener('mouseleave', () => {
            scrollIndicator.style.transform = 'scale(1)';
            scrollIndicator.style.opacity = '0.7';
        });

        // Hide scroll indicator when user starts scrolling
        let scrollIndicatorTimeout;
        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 100) {
                scrollIndicator.style.opacity = '0';
                scrollIndicator.style.pointerEvents = 'none';
            } else {
                clearTimeout(scrollIndicatorTimeout);
                scrollIndicator.style.opacity = '0.7';
                scrollIndicator.style.pointerEvents = 'auto';
                
                // Auto-hide after a delay when at top
                scrollIndicatorTimeout = setTimeout(() => {
                    if (window.pageYOffset <= 100) {
                        scrollIndicator.style.opacity = '0.5';
                    }
                }, 3000);
            }
        });
    }

    // Step scroll indicators
    const stepScrollIndicators = document.querySelectorAll('.step-scroll-indicator');
    stepScrollIndicators.forEach((indicator, index) => {
        indicator.addEventListener('click', () => {
            // Find the next section
            const allSections = document.querySelectorAll('.section[data-step]');
            const nextSection = allSections[index + 1];
            
            if (nextSection) {
                nextSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            } else {
                // If it's the last step, scroll to footer
                const footer = document.querySelector('.footer');
                if (footer) {
                    footer.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });

        // Add hover tooltip
        const currentSection = indicator.closest('.section');
        const stepId = currentSection?.getAttribute('data-step');
        const currentStepTitle = stepTitles[stepId] || 'Next';
        
        indicator.title = `Continue to next step`;
        
        // Hide indicator on last step
        if (index === stepScrollIndicators.length - 1) {
            indicator.title = 'Scroll to bottom';
        }
    });
    
    // Copy code functionality for code blocks
    document.querySelectorAll('.code-block').forEach(codeBlock => {
        // Skip if it contains a link
        if (codeBlock.querySelector('a')) {
            return;
        }
        
        // Add copy button
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-button';
        copyButton.innerHTML = '📋';
        copyButton.title = 'Copy to clipboard';
        copyButton.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(59, 130, 246, 0.2);
            border: 1px solid rgba(59, 130, 246, 0.3);
            border-radius: 6px;
            padding: 8px;
            color: #60a5fa;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.3s ease;
        `;
        
        copyButton.addEventListener('mouseenter', () => {
            copyButton.style.background = 'rgba(59, 130, 246, 0.3)';
            copyButton.style.transform = 'scale(1.1)';
        });
        
        copyButton.addEventListener('mouseleave', () => {
            copyButton.style.background = 'rgba(59, 130, 246, 0.2)';
            copyButton.style.transform = 'scale(1)';
        });
        
        copyButton.addEventListener('click', async () => {
            const code = codeBlock.querySelector('code');
            const text = code ? code.textContent : codeBlock.textContent;
            
            try {
                await navigator.clipboard.writeText(text);
                copyButton.innerHTML = '✅';
                copyButton.style.color = '#10b981';
                
                setTimeout(() => {
                    copyButton.innerHTML = '📋';
                    copyButton.style.color = '#60a5fa';
                }, 2000);
            } catch (err) {
                console.warn('Failed to copy text: ', err);
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                
                copyButton.innerHTML = '✅';
                setTimeout(() => {
                    copyButton.innerHTML = '📋';
                }, 2000);
            }
        });
        
        codeBlock.style.position = 'relative';
        codeBlock.appendChild(copyButton);
    });
    
    // Parallax effect for hero section
    function updateParallax() {
        const scrolled = window.pageYOffset;
        const heroContent = document.querySelector('.hero-content');
        
        if (heroContent && scrolled < window.innerHeight) {
            const parallaxValue = scrolled * 0.3;
            heroContent.style.transform = `translateY(${parallaxValue}px)`;
            heroContent.style.opacity = 1 - (scrolled / window.innerHeight);
        }
    }
    
    // Add parallax to scroll handler
    const originalOnScroll = onScroll;
    onScroll = function() {
        originalOnScroll();
        if (!ticking) {
            requestAnimationFrame(() => {
                updateParallax();
            });
        }
    };
    
    // Initialize
    updateProgressBar();
    updateParallax();
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === ' ') {
            e.preventDefault();
            const currentSection = getCurrentSection();
            const nextSection = getNextSection(currentSection);
            if (nextSection) {
                nextSection.scrollIntoView({ behavior: 'smooth' });
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const currentSection = getCurrentSection();
            const prevSection = getPreviousSection(currentSection);
            if (prevSection) {
                prevSection.scrollIntoView({ behavior: 'smooth' });
            } else {
                hero.scrollIntoView({ behavior: 'smooth' });
            }
        }
    });
    
    function getCurrentSection() {
        const scrollPosition = window.pageYOffset + window.innerHeight / 2;
        for (let i = sections.length - 1; i >= 0; i--) {
            if (sections[i].offsetTop <= scrollPosition) {
                return sections[i];
            }
        }
        return null;
    }
    
    function getNextSection(currentSection) {
        if (!currentSection) return sections[0];
        const currentIndex = Array.from(sections).indexOf(currentSection);
        return sections[currentIndex + 1] || null;
    }
    
    function getPreviousSection(currentSection) {
        if (!currentSection) return null;
        const currentIndex = Array.from(sections).indexOf(currentSection);
        return sections[currentIndex - 1] || null;
    }
    
    // Performance optimization: reduce animations on low-end devices
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) {
        document.documentElement.style.setProperty('--animation-duration', '0.3s');
    }
    
    console.log('✨ Fedora GNOME installer website loaded successfully!');
});
