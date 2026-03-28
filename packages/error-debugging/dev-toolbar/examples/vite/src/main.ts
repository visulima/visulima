import "./style.css";

import type { DevToolbarApp } from "@visulima/dev-toolbar";

import { App } from "./App";

// eslint-disable-next-line no-unsanitized/property -- static, developer-controlled HTML; not user input
document.querySelector<HTMLDivElement>("#app")!.innerHTML = App();

// ── Error trigger buttons ─────────────────────────────────────────────────────

document.querySelector("#btn-throw-error")?.addEventListener("click", () => {
    // Throw inside setTimeout so it escapes the click handler's call stack and
    // reaches window.onerror, which @visulima/vite-overlay intercepts.
    setTimeout(() => {
        const cause = new TypeError("Cannot read properties of undefined (reading 'name')");
        const error = new Error("Example client error thrown from the dev-toolbar demo page");

        error.cause = cause;
        throw error;
    }, 0);
});

document.querySelector("#btn-unhandled-rejection")?.addEventListener("click", () => {
    // Unhandled Promise rejection — intercepted by vite-overlay's
    // window.addEventListener("unhandledrejection", ...) handler.
    void Promise.reject(new Error("Example unhandled Promise rejection from the dev-toolbar demo page"));
});

// ── Global DevTools API ───────────────────────────────────────────────────────

if (globalThis.window !== undefined && globalThis.__VISULIMA_DEVTOOLS__) {
    const exampleApp: DevToolbarApp = {
        icon: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2"/></svg>',
        id: "example-app",
        init(canvas, _, helpers) {
            const content = document.createElement("div");
            const pre = document.createElement("pre");
            const button = document.createElement("button");

            pre.id = "rpc-result";
            pre.style.cssText = "margin-top:8px;padding:8px;background:rgba(0,0,0,.3);border-radius:4px;overflow:auto;";

            button.id = "test-rpc";
            button.textContent = "Test RPC (Get Vite Config)";
            button.style.cssText = "padding:8px 16px;margin-top:8px;cursor:pointer;";
            button.addEventListener("click", async () => {
                pre.textContent = "Loading...";

                try {
                    const cfg = await helpers.rpc.getViteConfig();

                    pre.textContent = JSON.stringify(cfg, null, 2);
                } catch (error) {
                    pre.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
                }
            });

            const wrapper = document.createElement("div");

            wrapper.style.cssText = "padding:16px;color:white;";
            wrapper.append(Object.assign(document.createElement("h2"), { textContent: "Example App" }));
            wrapper.append(Object.assign(document.createElement("p"), { textContent: "Custom app registered via the global API." }));
            wrapper.append(button, pre);
            content.append(wrapper);
            canvas.append(content);
        },
        name: "Example",
    };

    globalThis.__VISULIMA_DEVTOOLS__.registerApp(exampleApp);
}

// ── Hook system ───────────────────────────────────────────────────────────────

if (globalThis.window !== undefined && globalThis.__DEV_TOOLBAR_HOOK__) {
    const hook = globalThis.__DEV_TOOLBAR_HOOK__;

    hook.on("devtools:init", () => {
        console.log("Dev Tools initialized!");
    });

    hook.on("devtools:open", (appId: string) => {
        console.log(`App opened: ${appId}`);
    });

    hook.on("devtools:close", () => {
        console.log("Dev Tools closed");
    });

    hook.addTimelineEvent("custom", {
        data: { message: "Hello from example!" },
        id: "example-1",
        level: "info",
        time: Date.now(),
        title: "Example Event",
    });
}
