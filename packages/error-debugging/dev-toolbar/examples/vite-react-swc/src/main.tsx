import "./index.css";

import type { DevToolbarApp } from "@visulima/dev-toolbar";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.tsx";

createRoot(document.querySelector("#root")!).render(
    <StrictMode>
        <App />
    </StrictMode>,
);

// ── Global DevTools API ───────────────────────────────────────────────────────

if (globalThis.window !== undefined && globalThis.__VISULIMA_DEVTOOLS__) {
    const exampleApp: DevToolbarApp = {
        icon: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 10h12M10 4l6 6-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        id: "react-swc-example-app",
        init(canvas) {
            const wrapper = document.createElement("div");

            wrapper.style.cssText = "padding:16px;color:white;";

            const heading = document.createElement("h2");

            heading.style.cssText = "margin:0 0 8px";
            heading.textContent = "React SWC Example";

            const desc = document.createElement("p");

            desc.style.cssText = "margin:0 0 12px;opacity:.7";
            desc.textContent = "Custom app registered in the Vite + React SWC dev-toolbar demo.";

            const hint = document.createElement("p");

            hint.style.cssText = "font-size:12px;opacity:.5";
            hint.textContent = "Open the browser console to see hook events.";

            wrapper.append(heading, desc, hint);
            canvas.append(wrapper);
        },
        name: "SWC App",
    };

    globalThis.__VISULIMA_DEVTOOLS__.registerApp(exampleApp);
}

// ── Hook system ───────────────────────────────────────────────────────────────

if (globalThis.window !== undefined && globalThis.__DEV_TOOLBAR_HOOK__) {
    const hook = globalThis.__DEV_TOOLBAR_HOOK__;

    hook.on("devtools:init", () => {
        console.log("[React SWC] Dev Toolbar initialized!");
    });

    hook.on("devtools:open", (appId: string) => {
        console.log(`[React SWC] App opened: ${appId}`);
    });

    hook.on("devtools:close", () => {
        console.log("[React SWC] Dev Toolbar closed");
    });

    hook.addTimelineEvent("custom", {
        data: { compiler: "SWC", framework: "React", message: "App mounted!" },
        id: "swc-mount",
        level: "info",
        time: Date.now(),
        title: "React SWC App Mounted",
    });
}
