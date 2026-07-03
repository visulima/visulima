export const App = (): string => `
<style>
    .demo-page {
        max-width: 860px;
        margin: 0 auto;
        padding: 2.5rem 1.5rem 8rem;
    }

    .demo-page h1 {
        font-size: 1.75rem;
        font-weight: 700;
        margin: 0 0 0.5rem;
        color: var(--color-text);
    }

    .demo-page .subtitle {
        color: var(--color-text-muted);
        font-size: 0.95rem;
        margin: 0 0 2.5rem;
    }

    .demo-card {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 10px;
        padding: 1.25rem 1.5rem;
        margin-bottom: 1.25rem;
    }

    .demo-card h2 {
        font-size: 1rem;
        font-weight: 600;
        margin: 0 0 0.875rem;
        color: var(--color-text);
    }

    .demo-card ul,
    .demo-card ol {
        margin: 0;
        padding-left: 1.25rem;
        color: var(--color-text);
        font-size: 0.9rem;
        line-height: 1.75;
    }

    .demo-card.accent {
        background: var(--color-accent-bg);
        border-color: var(--color-accent-border);
    }

    .demo-card.warn {
        background: var(--color-warn-bg);
        border-color: var(--color-warn-border);
    }

    .badge {
        display: inline-block;
        font-size: 0.7rem;
        font-weight: 600;
        padding: 0.15em 0.5em;
        border-radius: 999px;
        vertical-align: middle;
        margin-right: 0.35rem;
        background: #22c55e20;
        color: #16a34a;
    }

    .error-section {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin-top: 0.75rem;
    }

    .btn {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.5rem 1rem;
        border-radius: 6px;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        border: none;
        transition: background 0.15s, transform 0.1s;
        font-family: inherit;
    }

    .btn:active {
        transform: scale(0.97);
    }

    .btn-error {
        background: var(--color-btn-error);
        color: #fff;
    }

    .btn-error:hover {
        background: var(--color-btn-error-hover);
    }

    .btn-warn {
        background: var(--color-btn-warn);
        color: #fff;
    }

    .btn-warn:hover {
        background: var(--color-btn-warn-hover);
    }

    .demo-code {
        background: var(--color-code-bg);
        color: var(--color-code-text);
        padding: 1rem 1.25rem;
        border-radius: 6px;
        font-family: 'Fira Code', 'Cascadia Code', ui-monospace, monospace;
        font-size: 0.8rem;
        line-height: 1.7;
        overflow-x: auto;
        margin: 0.75rem 0 0;
        white-space: pre;
    }

    .hint {
        margin-top: 0.625rem;
        font-size: 0.8rem;
        color: var(--color-text-muted);
    }
</style>

<div class="demo-page">
    <h1>Vite + Dev Toolbar Example</h1>
    <p class="subtitle">Demonstrates <code>@visulima/dev-toolbar</code> and <code>@visulima/vite-overlay</code> integration.</p>

    <div class="demo-card accent">
        <h2>Features</h2>
        <ul>
            <li><span class="badge">✓</span>Dev Toolbar with built-in apps (Settings, Timeline)</li>
            <li><span class="badge">✓</span>Custom app registration via global API</li>
            <li><span class="badge">✓</span>Iframe app — JSON Formatter loaded via <code>view.type = "iframe"</code></li>
            <li><span class="badge">✓</span>RPC communication with the Vite server</li>
            <li><span class="badge">✓</span>Hook system for event subscriptions</li>
            <li><span class="badge">✓</span>vite-overlay error integration — red badge in toolbar</li>
        </ul>
    </div>

    <div class="demo-card warn">
        <h2>Test Error Handling</h2>
        <p style="margin: 0 0 0.75rem; font-size: 0.875rem; color: var(--color-text);">
            Trigger a client-side error to see it captured by <strong>@visulima/vite-overlay</strong>.
            A red error badge will appear in the dev-toolbar. Click it to open the overlay.
        </p>
        <div class="error-section">
            <button class="btn btn-error" id="btn-throw-error">
                ⚠ Throw Runtime Error
            </button>
            <button class="btn btn-warn" id="btn-unhandled-rejection">
                ↯ Unhandled Rejection
            </button>
        </div>
        <p class="hint">Both events are intercepted by vite-overlay and forwarded through the WebSocket to the overlay.</p>
    </div>

    <div class="demo-card">
        <h2>How to Use the Toolbar</h2>
        <ol>
            <li>The toolbar pill is docked at the bottom-center — drag it to reposition</li>
            <li>Click the Visulima logo to toggle the panel open/closed</li>
            <li>Click the <strong>Settings</strong> icon to adjust toolbar preferences</li>
            <li>Throw an error above — a red badge counter appears next to the other icons</li>
            <li>Click the red badge to open/close the error overlay</li>
        </ol>
    </div>

    <div class="demo-card">
        <h2>Global API (browser console)</h2>
        <div class="demo-code">// Show / hide the toolbar
window.__VISULIMA_DEVTOOLS__.show();
window.__VISULIMA_DEVTOOLS__.hide();

// Open a specific app
window.__VISULIMA_DEVTOOLS__.openApp('dev-toolbar:settings');

// Add a notification badge to an app
window.__VISULIMA_DEVTOOLS__.notify('example-app', 'info');

// Call a server RPC function
await window.__VISULIMA_DEVTOOLS__.rpc.getViteConfig();

// Open / close the error overlay directly
window.__visulima_overlay__.open();
window.__visulima_overlay__.close();</div>
    </div>
</div>
`;
