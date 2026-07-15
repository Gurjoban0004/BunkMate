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
    ios: 'Works on iPhone and iPad. Must be installed from Safari.',
    android: 'Android 8.0 and up. Open source, and safe to install.',
};

document.addEventListener('DOMContentLoaded', () => {
    // Already installed? Go straight into the app.
    if (isPWA()) {
        window.location.href = '/app';
        return;
    }

    const segIos = document.getElementById('seg-ios');
    const segAndroid = document.getElementById('seg-android');
    const panelIos = document.getElementById('panel-ios');
    const panelAndroid = document.getElementById('panel-android');
    const btnIos = document.getElementById('btn-ios');
    const btnAndroid = document.getElementById('btn-android');
    const note = document.getElementById('install-note');

    // ===== Segmented platform picker =====
    const selectPlatform = (platform) => {
        const isIos = platform === 'ios';
        segIos.setAttribute('aria-selected', String(isIos));
        segAndroid.setAttribute('aria-selected', String(!isIos));
        panelIos.hidden = !isIos;
        panelAndroid.hidden = isIos;
        note.textContent = isIos ? NOTES.ios : NOTES.android;
    };

    segIos.addEventListener('click', () => selectPlatform('ios'));
    segAndroid.addEventListener('click', () => selectPlatform('android'));

    // Default to the visitor's device (iOS is the fallback for desktop).
    selectPlatform(detectPlatform() === 'android' ? 'android' : 'ios');

    // ===== iPhone — open the app in the browser to install =====
    btnIos.addEventListener('click', () => {
        window.location.href = '/app';
    });

    // ===== Android — download the APK =====
    btnAndroid.addEventListener('click', () => {
        const link = document.createElement('a');
        link.href = APK_URL;
        link.download = 'presence.apk';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // ===== Entrance reveal (respects reduced motion) =====
    const sections = document.querySelectorAll('.fade-up');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion) {
        sections.forEach((el) => el.classList.add('visible'));
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12 });

    sections.forEach((el, i) => {
        if (i < 2) {
            // Reveal the hero + install flow immediately, lightly staggered.
            setTimeout(() => el.classList.add('visible'), 80 + i * 110);
        } else {
            observer.observe(el);
        }
    });
});
