import DOMPurify from "isomorphic-dompurify";
import type { Theme } from "src/types";

import { sanitizeCspNonce } from "./utils/sanitize";

// HTML escape function for text content
const escapeHtml = (value: string): string =>
    value.replaceAll(/[&<>"']/g, (char) => {
        const entities: Record<string, string> = {
            "\"": "&quot;",
            "&": "&amp;",
            "'": "&#39;",
            "<": "&lt;",
            ">": "&gt;",
        };

        return entities[char] || char;
    });

// Client-side utility scripts
const DOM_READY_SCRIPT = `
    // Ensures listeners run as soon as the DOM is interactive
    function subscribeToDOMContentLoaded(listener) {
        if (document.readyState !== 'loading') {
            try { listener(); } catch (_) {}
            return;
        }
        try { document.addEventListener('DOMContentLoaded', listener); } catch (_) {}
    }
`;

const KEYBOARD_SHORTCUTS_SCRIPT = `
    subscribeToDOMContentLoaded(() => {
        // Global keyboard shortcut for ? and Shift+/ to open shortcuts
        if (!window.__onoShortcutKeyBound) {
            window.__onoShortcutKeyBound = true;

            document.addEventListener('keydown', function(e) {
                if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
                    e.preventDefault();

                    // Find all shortcuts buttons
                    const shortcutsButtons = document.querySelectorAll('button[aria-label="Open keyboard shortcuts"]');

                    if (shortcutsButtons.length > 0) {
                        // Find the first visible button in the viewport
                        let visibleButton = null;

                        for (const button of shortcutsButtons) {
                            const rect = button.getBoundingClientRect();
                            const isVisible = rect.top >= 0 && rect.left >= 0 &&
                                            rect.bottom <= window.innerHeight &&
                                            rect.right <= window.innerWidth;

                            if (isVisible) {
                                visibleButton = button;
                                break;
                            }
                        }

                        // If no visible button found, use the first one
                        if (!visibleButton) {
                            visibleButton = shortcutsButtons[0];
                        }

                        // Trigger the button
                        if (visibleButton) {
                            visibleButton.click();
                        }
                    }
                }
            });
        }
    });
`;

// Generate script tag with optional nonce
const createScriptTag = (content: string, nonce?: string): string => {
    const nonceAttribute = nonce ? ` nonce="${escapeHtml(nonce)}"` : "";

    return `<script${nonceAttribute}>${content}</script>`;
};

// Generate style tag with optional nonce
const createStyleTag = (content: string, nonce?: string): string => {
    const nonceAttribute = nonce ? ` nonce="${escapeHtml(nonce)}"` : "";

    return `<style${nonceAttribute}>${content}</style>`;
};

// Generates the complete HTML layout for the error inspector page
const layout = ({
    content,
    cspNonce,
    css,
    description,
    error,
    scripts,
    theme,
    title,
}: {
    content: string;
    cspNonce?: string;
    css: string;
    description: string;
    error: Error;
    scripts: string[];
    theme?: Theme;
    title: string;
}): string => {
    // Sanitize CSP nonce to prevent XSS
    const safeCspNonce = sanitizeCspNonce(cspNonce);

    // Escape title and description to prevent HTML injection
    const safeTitle = escapeHtml(title || "Error");
    const safeDescription = escapeHtml(description || "");

    // Optimize stack processing - only indent if stack exists and contains newlines
    const rawStack = error.stack || error.toString();
    const errorStack = DOMPurify.sanitize(rawStack.includes("\n") ? rawStack.replaceAll("\n", "\n\t") : rawStack);

    return `<!--
    ${errorStack}
    -->
    <!DOCTYPE html>
    <html lang="en" class="${theme === "dark" ? "dark" : ""}">
    <head>
        <meta charset="UTF-8">
        <title>${safeTitle}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="description" content="${safeDescription}">
        ${createStyleTag(css, safeCspNonce)}
        ${createScriptTag(DOM_READY_SCRIPT.trim(), safeCspNonce)}
        ${scripts
            .filter(Boolean)
            .map((script) => createScriptTag(script, safeCspNonce))
            .join("\n")}
        ${createScriptTag(KEYBOARD_SHORTCUTS_SCRIPT.trim(), safeCspNonce)}
    </head>
    <body>
        <div id="visulima-ono-container" class="bg-[var(--ono-bg)] text-[var(--ono-text)]">
            <main class="container mx-auto mt-6">
                ${content}
            </main>
        </div>
    </body>
    </html>
    <!--
    ${errorStack}
    -->
    `;
};

export default layout;
