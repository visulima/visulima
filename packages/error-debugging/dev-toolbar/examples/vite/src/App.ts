export const App = (): string => `
        <div style="padding: 2rem; max-width: 800px; margin: 0 auto;">
            <h1>Vite + Dev Toolbar Example</h1>
            <p>This example demonstrates the @visulima/dev-toolbar plugin.</p>
            
            <div style="margin-top: 2rem; padding: 1rem; background: #f5f5f5; border-radius: 8px;">
                <h2>Features Demonstrated:</h2>
                <ul>
                    <li>✅ Dev Toolbar with built-in apps (Settings, Timeline, More)</li>
                    <li>✅ Custom app registration via global API</li>
                    <li>✅ RPC communication (server functions)</li>
                    <li>✅ Hook system for event subscriptions</li>
                    <li>✅ Timeline event tracking</li>
                </ul>
            </div>

            <div style="margin-top: 2rem; padding: 1rem; background: #e3f2fd; border-radius: 8px;">
                <h2>Try It Out:</h2>
                <ol>
                    <li>Look at the bottom of the screen - you should see the dev toolbar</li>
                    <li>Click on the Settings icon to open the settings app</li>
                    <li>Click on the Timeline icon to view events</li>
                    <li>Check the browser console for hook events</li>
                    <li>Open the Example app (custom app) and click "Test RPC"</li>
                </ol>
            </div>

            <div style="margin-top: 2rem; padding: 1rem; background: #fff3e0; border-radius: 8px;">
                <h2>Global API:</h2>
                <p>Open the browser console and try:</p>
                <pre style="background: #263238; color: #aed581; padding: 1rem; border-radius: 4px; overflow-x: auto;">
// Show/hide toolbar
window.__VISULIMA_DEVTOOLS__.show();
window.__VISULIMA_DEVTOOLS__.hide();

// Open an app
window.__VISULIMA_DEVTOOLS__.openApp('dev-toolbar:settings');

// Get all apps
window.__VISULIMA_DEVTOOLS__.getApps();

// Add a notification
window.__VISULIMA_DEVTOOLS__.notify('example-app', 'info');

// Use RPC
await window.__VISULIMA_DEVTOOLS__.rpc.getViteConfig();
                </pre>
            </div>
        </div>
    `;
