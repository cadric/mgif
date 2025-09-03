(function (root) {
'use strict';

let __timingsCache = null;
let __cacheKey = '';

const __timingsKey = () => {
    const motionKey = (matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) ? 'pr' : 'pn';
    const viewportKey = (innerWidth || 0);
    return `${motionKey}:${viewportKey}`;
};

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

(function() {
    const mql = (typeof matchMedia === 'function') && matchMedia('(prefers-reduced-motion: reduce)');
    if (mql && mql.addEventListener) {
        mql.addEventListener('change', () => { __timingsCache = null; });
    }
    addEventListener('resize', () => { __timingsCache = null; });
})();

class FedoraInstallerUI {
    #progressEl;
    #collectedSteps;
    #sections;
    #hero;
    #currentSectionIndex = -1;
    #isTransitioning = false;
    #touchStartY = 0;
    #touchStartX = 0;
    
    #cursorCanvas;
    #cursorCtx;
    #cursorTarget;
    #mousePosition = { x: null, y: null };
    #cursorAnimationId = null;
    #isCursorActive = false;
    #lastMouseMoveTime = 0;
    #mouseInactivityTimeoutId = null;
    #mouseInactivityDelay = 2000;
    
    #prefersReducedMotion = false;
    #timings = null;
    
    #stepTitles = {
        'intro': 'Introduction',
        '1': 'Download Fedora Everything',
        '2': 'Login and Switch to Root',
        '3': 'Run the Installation Script',
        '4': 'Answer Configuration Questions',
        '5': 'Enjoy Your New Desktop'
    };

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
            console.error('Failed to initialize DOM elements:', err);
            throw err;
        }
    }

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
            });
        } catch (err) {
            console.error('Failed to initialize copy buttons:', err);
        }
    }

    #setupPageTransitions() {
        this.#hero?.classList.add('visible');
        this.#currentSectionIndex = -1;
        this.#updateProgressBar();
    }

    #initializeCursorArrow() {
        try {
            this.#cursorCanvas = document.getElementById('hero-cursor-overlay');
            this.#cursorTarget = document.getElementById('hero-scroll-target');
            
            if (!this.#cursorCanvas || !this.#cursorTarget) {
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
                    
                    if (this.#mouseInactivityTimeoutId) {
                        clearTimeout(this.#mouseInactivityTimeoutId);
                        this.#mouseInactivityTimeoutId = null;
                    }
                    
                    if (!this.#isCursorActive) {
                        this.#startCursorAnimation();
                    }
                    
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
            console.error('Failed to initialize cursor arrow:', err);
        }
    }

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

    #isFromScrollableElement(target) {
        return target?.closest('pre, code, textarea, .scroll, [data-scrollable="true"], .video-showcase');
    }

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

    #shouldNavigateByWheelOrSwipe(deltaY, originEl) {
        if (this.#currentSectionIndex === -1) return true;
        if (this.#isFromScrollableElement(originEl)) return false;
        return !this.#shouldAllowSectionScroll({ deltaY });
    }

    #goToNextSection() {
        if (this.#isTransitioning) return;
        
        const nextIndex = this.#currentSectionIndex + 1;
        if (nextIndex < this.#sections.length) {
            this.#goToSection(nextIndex);
        }
    }

    #goToPreviousSection() {
        if (this.#isTransitioning) return;
        
        const prevIndex = this.#currentSectionIndex - 1;
        if (prevIndex >= -1) {
            this.#goToSection(prevIndex);
        }
    }

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
                const heroTitle = document.getElementById('hero-title');
                heroTitle?.focus();
            } else {
                const targetSection = this.#sections[sectionIndex];
                if (targetSection) {
                    targetSection.classList.add('visible', 'active');
                    
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
            console.error('Failed to render section immediately:', err);
        }
    }

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
            console.warn('Failed to setup history API:', err);
        }
    }

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
            console.warn('Failed to update history:', err);
        }
    }

    #handleHistoryNavigation() {
        try {
            const hash = globalThis.location.hash;
            const sectionIndex = this.#getSectionIndexFromHash(hash);
            
            if (sectionIndex !== null && sectionIndex !== this.#currentSectionIndex) {
                this.#goToSection(sectionIndex);
            }
        } catch (err) {
            console.warn('Failed to handle history navigation:', err);
        }
    }

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
            console.error('Failed to collect step:', err);
        }
    }

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
            console.error('Failed to update collected steps aria attributes:', err);
        }
    }

    #highlightElement(element) {
        try {
            element.classList.add('highlight');
            
            setTimeout(() => {
                element.classList.remove('highlight');
            }, this.#timings.highlight);
            
            element.classList.add('has-hover-effects');
            
        } catch (err) {
            console.error('Failed to highlight element:', err);
        }
    }

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
            console.error('Failed to update progress bar:', err);
        }
    }

    #initializeShowcaseVideo() {
        const video = document.querySelector('.showcase-video');
        if (!video) return;

        try {
            const handleVideoLoad = () => {
                video.setAttribute('data-loaded', 'true');
                video.setAttribute('aria-busy', 'false');
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
                console.error('Video failed to load:', error);
                this.#handleVideoError(video);
            }, { once: true });

            this.#initializeVideoControls(video);
            this.#respectUserPreferences(video);

        } catch (err) {
            console.error('Failed to initialize showcase video:', err);
            this.#handleVideoError(video);
        }
    }

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
                console.error('Video play failed:', error);
                this.#handleVideoPlayError(error);
            }
        });

        const videoContainer = video.closest('.video-showcase');
        videoContainer?.appendChild(playButton);
    }

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

    #handleVideoPlayError(error, video = null, retryButton = null) {
        console.warn('Video play failed:', error.name, error.message);
        
        if (retryButton && video) {
            this.#addRetryToVideoButton(retryButton, video);
        } else {
            showErrorToast('Failed to play video. Please try again.');
        }
    }

    #addRetryToVideoButton(button, video) {
        const originalText = button.querySelector('.play-overlay-text')?.textContent || 'Play Video';
        const textElement = button.querySelector('.play-overlay-text');
        
        if (textElement) {
            textElement.textContent = 'Retry Video';
        }
        
        button.classList.add('retry-state');
        
        setTimeout(() => {
            if (textElement) {
                textElement.textContent = originalText;
            }
            button.classList.remove('retry-state');
        }, 3000);
    }

    #initialize() {
        this.#updateProgressBar();
        this.#initializeShowcaseVideo();
    }

    #updateCanvasSize() {
        if (!this.#cursorCanvas) return;
        
        this.#cursorCanvas.width = globalThis.innerWidth;
        this.#cursorCanvas.height = globalThis.innerHeight;
    }

    #startCursorAnimation() {
        if (this.#isCursorActive || !this.#cursorCanvas) return;
        
        this.#isCursorActive = true;
        this.#cursorCanvas.classList.add('active');
        this.#animateCursorArrow();
    }

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

    #clearCanvas() {
        if (this.#cursorCtx && this.#cursorCanvas) {
            this.#cursorCtx.clearRect(0, 0, this.#cursorCanvas.width, this.#cursorCanvas.height);
        }
    }

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
            
        } catch (err) {
            console.error('Failed to cleanup FedoraInstallerUI:', err);
        }
    }

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

        } catch (err) {
            console.error('Failed to wire up destroy method:', err);
        }
    }
}

let __uiInstance = null;

const initializeProgressiveEnhancements = () => {
    if (__uiInstance) return __uiInstance;
    
    try {
        if (!('requestAnimationFrame' in globalThis)) {
            throw new Error('RequestAnimationFrame not supported');
        }

        __uiInstance = new FedoraInstallerUI();
        
        setupCopyButtons();
        setupSmoothScrolling();
        
        document.documentElement.classList.remove('no-js');
        
        return __uiInstance;
        
    } catch (err) {
        console.error('Failed to initialize Fedora Installer UI:', err);
        showErrorToast('Something went wrong loading the page. Please refresh and try again.');
        return null;
    }
};

document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', initializeProgressiveEnhancements)
    : initializeProgressiveEnhancements();

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
            console.warn('Clipboard API failed, falling back:', error);
            fallbackCopyText(text, btn);
        });
    });
};

const setupSmoothScrolling = () => {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', (e) => {
            const targetId = anchor.getAttribute('href').slice(1);
            const targetElement = targetId ? document.getElementById(targetId) : null;
            
            if (targetElement) {
                e.preventDefault();
                
                const smoothOK = !matchMedia('(prefers-reduced-motion: reduce)').matches;
                
                const priorTabindex = targetElement.getAttribute('tabindex');
                targetElement.setAttribute('tabindex', '-1');
                
                targetElement.focus({ preventScroll: true });
                targetElement.scrollIntoView({ 
                    behavior: smoothOK ? 'smooth' : 'auto', 
                    block: 'start' 
                });
                
                if (priorTabindex === null) {
                    targetElement.removeAttribute('tabindex');
                } else {
                    targetElement.setAttribute('tabindex', priorTabindex);
                }
            }
        });
    });
};

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
            console.warn('Document.execCommand copy failed');
        }
        
    } catch (err) {
        console.error('Fallback copy failed:', err);
        showCopyFeedback(button, false);
    }
};

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
    
    toast.textContent = message;
    toast.classList.remove('toast-success');
    toast.classList.add('toast-error');
    toast.removeAttribute('hidden');
    
    setTimeout(() => {
        toast.setAttribute('hidden', '');
    }, readCssTimings().toastDuration);
};

root.FedoraApp = {
    getInstance() {
        return __uiInstance;
    }
};

function updateProgressOffset() {
    const header = document.querySelector('.progress-container');
    const h = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty('--progress-offset', `${h}px`);
}

addEventListener('load', updateProgressOffset);
addEventListener('resize', updateProgressOffset);

const progressContainer = document.querySelector('.progress-container');
if (progressContainer && 'ResizeObserver' in globalThis) {
    new ResizeObserver(updateProgressOffset).observe(progressContainer);
}

})(typeof window !== 'undefined' ? window : this);
