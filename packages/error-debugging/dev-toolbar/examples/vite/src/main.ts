import "./style.css";

import { App } from "./App.js";

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = App();

// Example: Using the global DevTools API
if (typeof window !== "undefined" && window.__VISULIMA_DEVTOOLS__) {
    console.log("Dev Tools API available:", window.__VISULIMA_DEVTOOLS__);

    // Example: Register a custom app
    window.__VISULIMA_DEVTOOLS__.registerApp({
        id: "example-app",
        name: "Example",
        icon: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2"/></svg>',
        init(canvas, eventTarget, helpers) {
            const content = document.createElement("div");
            content.innerHTML = `
                <div style="padding: 16px; color: white;">
                    <h2>Example App</h2>
                    <p>This is a custom app registered via the global API!</p>
                    <button id="test-rpc" style="padding: 8px 16px; margin-top: 8px; cursor: pointer;">
                        Test RPC (Get Vite Config)
                    </button>
                    <pre id="rpc-result" style="margin-top: 8px; padding: 8px; background: rgba(0,0,0,0.3); border-radius: 4px; overflow: auto;"></pre>
                </div>
            `;
            canvas.appendChild(content);

            const button = content.querySelector("#test-rpc");
            const result = content.querySelector("#rpc-result");

            button?.addEventListener("click", async () => {
                if (result) {
                    result.textContent = "Loading...";
                    try {
                        const config = await helpers.rpc.getViteConfig();
                        result.textContent = JSON.stringify(config, null, 2);
                    } catch (error) {
                        result.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
                    }
                }
            });
        },
    });
}

// Example: Using the hook system
if (typeof window !== "undefined" && window.__DEV_TOOLBAR_HOOK__) {
    const hook = window.__DEV_TOOLBAR_HOOK__;

    hook.on("devtools:init", () => {
        console.log("Dev Tools initialized!");
    });

    hook.on("devtools:open", (appId) => {
        console.log(`App opened: ${appId}`);
    });

    hook.on("devtools:close", () => {
        console.log("Dev Tools closed");
    });

    // Add a timeline event
    hook.addTimelineEvent("custom", {
        id: "example-1",
        title: "Example Event",
        time: Date.now(),
        level: "info",
        data: { message: "Hello from example!" },
    });
}
