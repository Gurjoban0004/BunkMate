// ===== Platform detection =====
const detectPlatform = () => {
    const ua = navigator.userAgent || navigator.vendor || window.opera || '';
    if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return 'ios';
    if (/android/i.test(ua)) return 'android';
    return 'other';
};

const isPWA = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

const APK_URL = '/releases/presence-latest.apk';

const NOTES = {
    ios: 'Works on iPhone and iPad. Must be added to Home Screen from Safari.',
    android: 'Android 8.0 and up. Open source, verified, and safe to install.',
};

document.addEventListener('DOMContentLoaded', () => {
    // If the visitor launched the installed PWA on mobile, go straight to the app.
    if (isPWA()) {
        window.location.href = '/app';
        return;
    }

    const platform = detectPlatform();

    // ===== UI Elements =====
    const segIos = document.getElementById('seg-ios');
    const segAndroid = document.getElementById('seg-android');
    const panelIos = document.getElementById('panel-ios');
    const panelAndroid = document.getElementById('panel-android');
    const btnIos = document.getElementById('btn-ios');
    const btnAndroid = document.getElementById('btn-android');
    const heroBtnAndroid = document.getElementById('hero-btn-android');
    const note = document.getElementById('install-note');
    const stickyBar = document.getElementById('mobile-sticky-bar');
    const stickyBtn = document.getElementById('sticky-download-btn');
    const stickyMetaText = document.getElementById('sticky-meta-text');

    // ===== Direct APK Download Function =====
    const triggerApkDownload = () => {
        const link = document.createElement('a');
        link.href = APK_URL;
        link.download = 'presence.apk';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // ===== Install Segmented Picker =====
    const selectPlatform = (p) => {
        const isIos = p === 'ios';
        if (segIos && segAndroid && panelIos && panelAndroid) {
            segIos.setAttribute('aria-selected', String(isIos));
            segAndroid.setAttribute('aria-selected', String(!isIos));
            panelIos.hidden = !isIos;
            panelAndroid.hidden = isIos;
        }
        if (note) {
            note.textContent = isIos ? NOTES.ios : NOTES.android;
        }
    };

    if (segIos && segAndroid) {
        segIos.addEventListener('click', () => selectPlatform('ios'));
        segAndroid.addEventListener('click', () => selectPlatform('android'));
    }

    // Default to the visitor's device
    selectPlatform(platform === 'android' ? 'android' : 'ios');

    // Update sticky bar based on platform
    if (stickyMetaText && stickyBtn) {
        if (platform === 'ios') {
            stickyMetaText.textContent = 'Safari Web App';
            stickyBtn.innerHTML = '<span>Open App</span>';
            stickyBtn.addEventListener('click', () => {
                window.location.href = '/app';
            });
        } else {
            stickyMetaText.textContent = 'v2.1 APK · 59 MB';
            stickyBtn.innerHTML = '<span>Download APK</span>';
            stickyBtn.addEventListener('click', (e) => {
                e.preventDefault();
                triggerApkDownload();
            });
        }
    }

    // Connect Android download buttons
    if (btnAndroid) {
        btnAndroid.addEventListener('click', (e) => {
            e.preventDefault();
            triggerApkDownload();
        });
    }

    if (heroBtnAndroid) {
        heroBtnAndroid.addEventListener('click', (e) => {
            if (platform === 'android') {
                e.preventDefault();
                triggerApkDownload();
            }
            // On desktop/iOS, let the standard anchor link navigate or scroll down
        });
    }

    if (btnIos) {
        btnIos.addEventListener('click', () => {
            window.location.href = '/app';
        });
    }

    // ===== Mobile Carousel & Sync =====
    const gallery = document.getElementById('showcase-gallery');
    const screenTabs = document.querySelectorAll('.screen-tab');
    const showcaseCards = document.querySelectorAll('.showcase-card');
    const dots = document.querySelectorAll('.showcase-dots .dot');

    const updateActiveIndex = (index) => {
        screenTabs.forEach((tab, i) => {
            const isActive = i === index;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', String(isActive));
        });

        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
        });

        showcaseCards.forEach((card, i) => {
            card.classList.toggle('active', i === index);
        });
    };

    // Tab click navigation
    screenTabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            const index = parseInt(tab.getAttribute('data-index'), 10);
            updateActiveIndex(index);

            if (gallery && showcaseCards[index]) {
                const targetCard = showcaseCards[index];
                gallery.scrollTo({
                    left: targetCard.offsetLeft - gallery.offsetLeft,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Dot click navigation
    dots.forEach((dot) => {
        dot.addEventListener('click', () => {
            const index = parseInt(dot.getAttribute('data-index'), 10);
            updateActiveIndex(index);

            if (gallery && showcaseCards[index]) {
                const targetCard = showcaseCards[index];
                gallery.scrollTo({
                    left: targetCard.offsetLeft - gallery.offsetLeft,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Touch scroll synchronization in gallery (debounce for performance)
    if (gallery) {
        let scrollTimeout;
        gallery.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                const scrollLeft = gallery.scrollLeft;
                const cardWidth = showcaseCards[0] ? showcaseCards[0].offsetWidth + 16 : 300;
                const currentIndex = Math.round(scrollLeft / cardWidth);
                const boundedIndex = Math.max(0, Math.min(currentIndex, showcaseCards.length - 1));
                updateActiveIndex(boundedIndex);
            }, 60);
        }, { passive: true });
    }

    // ===== Mobile Sticky Bar on Scroll =====
    const heroSection = document.querySelector('.hero-section');
    if (stickyBar && heroSection) {
        window.addEventListener('scroll', () => {
            const heroBottom = heroSection.getBoundingClientRect().bottom;
            if (heroBottom < 60) {
                stickyBar.classList.add('visible');
            } else {
                stickyBar.classList.remove('visible');
            }
        }, { passive: true });
    }

    // ===== Scroll Entrance Animations =====
    const sections = document.querySelectorAll('.fade-up');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion) {
        sections.forEach((el) => el.classList.add('visible'));
        return;
    }

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.06 }
    );

    sections.forEach((el, i) => {
        if (i < 2) {
            setTimeout(() => el.classList.add('visible'), 50 + i * 80);
        } else {
            observer.observe(el);
        }
    });
});
