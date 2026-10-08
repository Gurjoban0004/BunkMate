import { useEffect } from 'react';
import { createViewportDebug } from './viewportDebug';

/** iOS keyboards resize the visual viewport, not the document's layout viewport. */
export default function useWebViewport() {
    useEffect(() => {
        const viewport = window.visualViewport;
        if (!viewport) return undefined;
        const root = document.documentElement;
        const debug = createViewportDebug();
        let frame = 0;
        let wasOpen = false;
        const apply = () => {
            window.cancelAnimationFrame(frame);
            frame = window.requestAnimationFrame(() => {
                const inset = viewport.scale > 1.01 ? 0 : Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
                const open = inset > 80;
                root.style.setProperty('--presence-vv-height', `${viewport.height}px`);
                root.style.setProperty('--presence-vv-top', `${viewport.offsetTop}px`);
                root.style.setProperty('--kb-inset', `${inset}px`);
                root.dataset.keyboard = open ? 'open' : 'closed';
                if (wasOpen && !open && viewport.scale <= 1.01) window.scrollTo(0, 0);
                wasOpen = open;
                debug?.update();
            });
        };
        viewport.addEventListener('resize', apply);
        viewport.addEventListener('scroll', apply);
        window.addEventListener('orientationchange', apply);
        document.addEventListener('visibilitychange', apply);
        apply();
        return () => {
            window.cancelAnimationFrame(frame);
            viewport.removeEventListener('resize', apply);
            viewport.removeEventListener('scroll', apply);
            window.removeEventListener('orientationchange', apply);
            document.removeEventListener('visibilitychange', apply);
            delete root.dataset.keyboard;
            root.style.removeProperty('--presence-vv-height');
            root.style.removeProperty('--presence-vv-top');
            root.style.removeProperty('--kb-inset');
            debug?.remove();
        };
    }, []);
}
