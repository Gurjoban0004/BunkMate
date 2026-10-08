export const WEB_SHELL_STYLES = `
        /* Global font. The blanket star selector + !important is deliberate:
           RN Web emits its own font-family class on every Text, TextInput and
           nav label, and this is the one rule that outranks all of them.
           Icons are SVG, so nothing here breaks glyphs. */
        * {
            font-family: 'Times New Roman', Times, serif !important;
        }
        html, body {
            height: 100%;
            margin: 0;
            overflow: hidden;
            overscroll-behavior: none;
            touch-action: pan-y;
            -webkit-text-size-adjust: 100%;
            background-color: var(--presence-background, #f8f6f2);
        }
        #root { position: fixed; inset: 0; height: auto; min-height: 0; overflow: hidden; }
        html[data-keyboard='open'] #root {
            position: fixed;
            top: var(--presence-vv-top, 0px);
            left: 0;
            right: 0;
            height: var(--presence-vv-height, 100%);
        }
        /* RN Web sets user-select:none globally; Safari treats that as
           "do not focus". Inputs must behave like normal web fields. */
        input, textarea, [contenteditable] {
            -webkit-user-select: text !important;
            user-select: text !important;
            pointer-events: auto !important;
            font-size: max(16px, 1em) !important;
        }
        #root, #root > div {
            pointer-events: auto !important;
        }
        input:focus, textarea:focus {
            outline: none;
        }
    `;
