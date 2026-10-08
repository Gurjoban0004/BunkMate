import { version } from '../../package.json';

/** Opt-in diagnostics for screenshots from an installed iPhone app. */
export function createViewportDebug() {
    if (new URLSearchParams(window.location.search).get('debug') !== 'viewport') return null;
    const readout = document.createElement('pre');
    readout.setAttribute('aria-label', 'Viewport diagnostics');
    readout.style.cssText = 'position:fixed;z-index:99999;top:env(safe-area-inset-top,0px);left:0;max-width:100%;margin:0;padding:8px;font:11px/1.4 monospace;background:#fff;color:#111;pointer-events:none;white-space:pre-wrap;';
    document.body.appendChild(readout);
    let cacheNames = 'unavailable';
    let live = true;
    if (window.caches) window.caches.keys().then((names) => { if (live) { cacheNames = names.filter((name) => name.startsWith('presence-')).join(', ') || 'none'; update(); } }).catch(() => {});
    function probe(css) {
        const element = document.createElement('div');
        element.style.cssText = `position:fixed;visibility:hidden;pointer-events:none;${css}`;
        document.body.appendChild(element);
        const height = element.getBoundingClientRect().height;
        const style = window.getComputedStyle(element);
        const padding = [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft];
        element.remove();
        return { height, padding };
    }
    function update() {
        const viewport = window.visualViewport;
        const modes = ['standalone', 'fullscreen', 'minimal-ui', 'browser'];
        const mode = modes.find((value) => window.matchMedia(`(display-mode: ${value})`).matches) || 'unknown';
        const root = document.documentElement;
        readout.textContent = [
            `Presence ${version} · SW cache ${cacheNames}`,
            `standalone: navigator=${navigator.standalone === true} media=${mode === 'standalone'} · mode=${mode}`,
            `inner ${window.innerWidth}×${window.innerHeight} · screen ${window.screen.width}×${window.screen.height}`,
            `visual ${viewport?.width}×${viewport?.height} top=${viewport?.offsetTop} left=${viewport?.offsetLeft} scale=${viewport?.scale}`,
            `safe T/R/B/L ${probe('padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);').padding.join('/')}`,
            `svh/lvh/dvh ${['svh', 'lvh', 'dvh'].map((unit) => probe(`height:100${unit}`).height).join('/')}`,
            `scrollTop ${document.scrollingElement?.scrollTop || 0} · kb-inset ${root.style.getPropertyValue('--kb-inset')} · keyboard ${root.dataset.keyboard}`,
        ].join('\n');
    }
    return { update, remove: () => { live = false; readout.remove(); } };
}
