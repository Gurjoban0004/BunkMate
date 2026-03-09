// ===== Platform Detection =====
const detectPlatform = () => {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return 'ios';
    if (/android/i.test(ua)) return 'android';
    return 'other';
};

// ===== Check if already in PWA mode =====
const isPWA = () => {
    return window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true;
};

document.addEventListener('DOMContentLoaded', () => {
    // If user is already in PWA, skip landing
    if (isPWA()) {
        window.location.href = '/app';
        return; // Stop further execution
    }
    const btnIOS = document.getElementById('btn-ios');
    const btnAndroid = document.getElementById('btn-android');
    const androidToggle = document.getElementById('android-toggle');
    const androidBody = document.getElementById('android-body');
    const androidChevron = document.getElementById('android-chevron');

    const APK_URL = '/releases/presence-latest.apk';

    // ===== Platform auto-highlight =====
    const platform = detectPlatform();

    if (platform === 'android') {
        // Auto-expand Android section on Android devices
        androidBody.classList.add('open');
        androidChevron.classList.add('open');
    }

    // ===== iOS Button — Navigate to app =====
    btnIOS.addEventListener('click', () => {
        // Scroll to iOS guide first to read instructions
        document.getElementById('ios-guide').scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });

        // Open the app after a longer delay so user can read instructions
        setTimeout(() => {
            window.location.href = '/app';
        }, 3000); // Increased from 800ms to 3 seconds
    });

    // ===== Android Button — Download APK =====
    btnAndroid.addEventListener('click', () => {
        // Expand android instructions if not already open
        if (!androidBody.classList.contains('open')) {
            androidBody.classList.add('open');
            androidChevron.classList.add('open');
        }

        // Trigger download
        const link = document.createElement('a');
        link.href = APK_URL;
        link.download = 'presence.apk';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // ===== Android Collapsible Toggle =====
    androidToggle.addEventListener('click', () => {
        androidBody.classList.toggle('open');
        androidChevron.classList.toggle('open');
    });

    // ===== Entrance Animations =====
    const sections = document.querySelectorAll(
        '.hero, .about, .features, .download-section, .setup-guide, .screenshots-section, .whats-new, .footer'
    );

    sections.forEach((el) => {
        el.classList.add('fade-in');
    });

    // Staggered reveal
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    sections.forEach((el, index) => {
        // First few sections animate immediately with stagger
        if (index < 4) {
            setTimeout(() => {
                el.classList.add('visible');
            }, 80 + (index * 100));
        } else {
            observer.observe(el);
        }
    });
});
