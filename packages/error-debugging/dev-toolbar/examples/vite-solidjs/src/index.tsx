/** @refresh reload */
import "./index.css";

import type { DevToolbarApp } from "@visulima/dev-toolbar";
import { render } from "solid-js/web";

import App from "./App.tsx";

const root = document.querySelector("#root");

render(() => <App />, root!);

// ── Global DevTools API ───────────────────────────────────────────────────────

if (globalThis.window !== undefined && globalThis.__VISULIMA_DEVTOOLS__) {
    const exampleApp: DevToolbarApp = {
        icon: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 3c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm0 10c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" fill="currentColor"/></svg>',
        id: "solidjs-example-app",
        init(canvas) {
            const wrapper = document.createElement("div");

            wrapper.style.cssText = "padding:16px;color:white;";

            const heading = document.createElement("h2");

            heading.style.cssText = "margin:0 0 8px";
            heading.textContent = "SolidJS Example";

            const desc = document.createElement("p");

            desc.style.cssText = "margin:0 0 12px;opacity:.7";
            desc.textContent = "Custom app registered in the SolidJS dev-toolbar demo.";

            const hint = document.createElement("p");

            hint.style.cssText = "font-size:12px;opacity:.5";
            hint.textContent = "Open the browser console to see hook events.";

            wrapper.append(heading, desc, hint);
            canvas.append(wrapper);
        },
        name: "SolidJS App",
    };

    globalThis.__VISULIMA_DEVTOOLS__.registerApp(exampleApp);
}

// ── Hook system ───────────────────────────────────────────────────────────────

if (globalThis.window !== undefined && globalThis.__DEV_TOOLBAR_HOOK__) {
    const hook = globalThis.__DEV_TOOLBAR_HOOK__;

    hook.on("devtools:init", () => {
        console.log("[SolidJS] Dev Toolbar initialized!");
    });

    hook.on("devtools:open", (appId: string) => {
        console.log(`[SolidJS] App opened: ${appId}`);
    });

    hook.on("devtools:close", () => {
        console.log("[SolidJS] Dev Toolbar closed");
    });

    hook.addTimelineEvent("custom", {
        data: { framework: "SolidJS", message: "App mounted!" },
        id: "solidjs-mount",
        level: "info",
        time: Date.now(),
        title: "SolidJS App Mounted",
    });
}
