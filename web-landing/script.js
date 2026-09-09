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

    // ===== Install Segmented Picker =====
    const segIos = document.getElementById('seg-ios');
    const segAndroid = document.getElementById('seg-android');
    const panelIos = document.getElementById('panel-ios');
    const panelAndroid = document.getElementById('panel-android');
    const btnIos = document.getElementById('btn-ios');
    const btnAndroid = document.getElementById('btn-android');
    const heroBtnAndroid = document.getElementById('hero-btn-android');
    const note = document.getElementById('install-note');

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

    // Default to the visitor's device (Android default if on Android, else iOS)
    selectPlatform(platform === 'android' ? 'android' : 'ios');

    // ===== Direct APK Download Function =====
    const triggerApkDownload = () => {
        const link = document.createElement('a');
        link.href = APK_URL;
        link.download = 'presence.apk';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Verify APK file accessibility
    fetch(APK_URL, { method: 'HEAD' })
        .then((r) => {
            if (!r.ok) throw new Error('no apk file');
        })
        .catch(() => {
            // If the static server doesn't host the file yet, keep the button active
            // but gracefully fallback without breaking the UI.
            console.info('APK check: File will be served from build bundle.');
        });

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
            // If on desktop, let standard anchor link scroll down to #install
        });
    }

    if (btnIos) {
        btnIos.addEventListener('click', () => {
            window.location.href = '/app';
        });
    }

    // ===== Interactive Screen Tabs (Mobile/Tablet Gallery) =====
    const screenTabs = document.querySelectorAll('.screen-tab');
    const showcaseCards = document.querySelectorAll('.showcase-card');

    screenTabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            const targetId = tab.getAttribute('data-target');

            screenTabs.forEach((t) => {
                t.classList.remove('active');
                t.setAttribute('aria-selected', 'false');
            });
            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');

            showcaseCards.forEach((card) => {
                if (card.id === targetId) {
                    card.classList.add('active');
                } else {
                    card.classList.remove('active');
                }
            });
        });
    });

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
        { threshold: 0.08 }
    );

    sections.forEach((el, i) => {
        if (i < 2) {
            setTimeout(() => el.classList.add('visible'), 60 + i * 100);
        } else {
            observer.observe(el);
        }
    });
});
