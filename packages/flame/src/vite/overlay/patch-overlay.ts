/*
    Replaces Vite's default overlay implementation with a custom overlay class.
    Pattern inspired by Astro: inject our overlay code and rename Vite's class to not conflict.
    Also provides a Tailwind-styled shell with multi-error stacking and navigation.
*/

// Load editable assets
import styleCss from "./client/style.css";
import templateHtml from "./client/template.html?raw";
import runtimeJs from "./client/runtime.js?raw";

const getOverlayCode = (): string => {
    const template = `\n<style>${styleCss}</style>\n${templateHtml}`;

    const runtime = String(runtimeJs).replace("/*__INJECT_TEMPLATE__*/", `this.root.innerHTML = ${JSON.stringify(template)};`);

    // Inject plain JS (no TS types) so it runs in Vite's client
    return `\n${runtime}\n`;
};

export const patchOverlay = (code: string): string => {
    const injected = getOverlayCode();
    let patched = code.replace("class ErrorOverlay", `${injected}\nclass ViteErrorOverlay`);

    // Replace any export of ErrorOverlay with alias to ViteErrorOverlay directly inside the list
    try {
        patched = patched.replace(/export\s*\{([^}]*)\}/g, (match, inner) => {
            if (!/\bErrorOverlay\b/.test(inner)) return match;
            
            const replaced = inner.replace(/\bErrorOverlay,/g, '');
            
            return `export { ${replaced} }`;
        });
    } catch {}

    return patched;
};

export default patchOverlay;
