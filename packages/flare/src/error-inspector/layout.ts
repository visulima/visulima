import DOMPurify from "isomorphic-dompurify";

const layout = ({
    content,
    cspNonce,
    css,
    description,
    error,
    scripts,
    title,
}: {
    content: string;
    cspNonce?: string;
    css: string;
    description: string;
    error: Error;
    scripts: string[];
    title: string;
}): string => {
    const errorStack = DOMPurify.sanitize(error.stack ? error.stack.replaceAll("\n", "\n\t") : error.toString());

    return `<!--
    ${errorStack}
    -->
    <!DOCTYPE html>
    <html lang="en" class="dark">
    <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="description" content="${description}">
        <style${cspNonce ? ` nonce="${cspNonce}"` : ""}>${css}</style>
        <script${cspNonce ? ` nonce="${cspNonce}"` : ""}>
            // Ensures listeners run as soon as the DOM is interactive
            function subscribeToDOMContentLoaded(listener) {
                if (document.readyState !== 'loading') {
                    try { listener(); } catch (_) {}
                    return;
                }
                try { document.addEventListener('DOMContentLoaded', listener); } catch (_) {}
            }
        </script>
        ${scripts
            .filter(Boolean)
            .map((script) => `<script${cspNonce ? ` nonce=\"${cspNonce}\"` : ""}>${script}</script>`)
            .join("\n")}
        <script${cspNonce ? ` nonce="${cspNonce}"` : ""}>
            subscribeToDOMContentLoaded(() => {
            // Global keyboard shortcut for ? and Shift+/ to open shortcuts
                if (!window.__flareShortcutKeyBound) {
                    window.__flareShortcutKeyBound = true;
                    
                    document.addEventListener('keydown', function(e) {
                        if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
                            e.preventDefault();

                            // Find all shortcuts buttons
                            const shortcutsButtons = document.querySelectorAll('.hs-tooltip-toggle');

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
            })
        </script>
    </head>
    <body>
        <div id="visulima-flare-container" class="bg-[var(--flare-bg)] text-[var(--flare-text)]">
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
