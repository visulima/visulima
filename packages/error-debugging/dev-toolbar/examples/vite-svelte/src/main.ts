import "./app.css";

import { mount } from "svelte";

import App from "./App.svelte";

const app = mount(App, {
    target: document.querySelector("#app")!,
});

export default app;

// ── Global DevTools API ───────────────────────────────────────────────────────

if (globalThis.window !== undefined && globalThis.__VISULIMA_DEVTOOLS__) {
    globalThis.__VISULIMA_DEVTOOLS__.registerApp({
        icon: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm1.5 11.5l-5-3 5-3v6z" fill="currentColor"/></svg>',
        id: "svelte-example-app",
        init(canvas) {
            const wrapper = document.createElement("div");

            wrapper.style.cssText = "padding:16px;color:white;";

            const heading = document.createElement("h2");

            heading.style.cssText = "margin:0 0 8px";
            heading.textContent = "Svelte Example";

            const desc = document.createElement("p");

            desc.style.cssText = "margin:0 0 12px;opacity:.7";
            desc.textContent = "Custom app registered in the Svelte dev-toolbar demo.";

            const hint = document.createElement("p");

            hint.style.cssText = "font-size:12px;opacity:.5";
            hint.textContent = "Open the browser console to see hook events.";

            wrapper.append(heading, desc, hint);
            canvas.append(wrapper);
        },
        name: "Svelte App",
    });
}

// ── Hook system ───────────────────────────────────────────────────────────────

if (globalThis.window !== undefined && globalThis.__DEV_TOOLBAR_HOOK__) {
    const hook = globalThis.__DEV_TOOLBAR_HOOK__;

    hook.on("devtools:init", () => {
        console.log("[Svelte] Dev Toolbar initialized!");
    });

    hook.on("devtools:open", (appId: string) => {
        console.log(`[Svelte] App opened: ${appId}`);
    });

    hook.on("devtools:close", () => {
        console.log("[Svelte] Dev Toolbar closed");
    });

    hook.addTimelineEvent("custom", {
        data: { framework: "Svelte", message: "App mounted!" },
        id: "svelte-mount",
        level: "info",
        time: Date.now(),
        title: "Svelte App Mounted",
    });
}
