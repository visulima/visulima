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
        icon: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="3" fill="currentColor"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
        id: "react-rolldown-example-app",
        init(canvas) {
            const wrapper = document.createElement("div");

            wrapper.style.cssText = "padding:16px;color:white;";

            const heading = document.createElement("h2");

            heading.style.cssText = "margin:0 0 8px";
            heading.textContent = "Rolldown-Vite Example";

            const desc = document.createElement("p");

            desc.style.cssText = "margin:0 0 12px;opacity:.7";
            desc.textContent = "Custom app registered in the Rolldown-Vite + React dev-toolbar demo.";

            const hint = document.createElement("p");

            hint.style.cssText = "font-size:12px;opacity:.5";
            hint.textContent = "Open the browser console to see hook events.";

            wrapper.append(heading, desc, hint);
            canvas.append(wrapper);
        },
        name: "Rolldown App",
    };

    globalThis.__VISULIMA_DEVTOOLS__.registerApp(exampleApp);
}

// ── Hook system ───────────────────────────────────────────────────────────────

if (globalThis.window !== undefined && globalThis.__DEV_TOOLBAR_HOOK__) {
    const hook = globalThis.__DEV_TOOLBAR_HOOK__;

    hook.on("devtools:init", () => {
        console.log("[Rolldown-Vite] Dev Toolbar initialized!");
    });

    hook.on("devtools:open", (appId: string) => {
        console.log(`[Rolldown-Vite] App opened: ${appId}`);
    });

    hook.on("devtools:close", () => {
        console.log("[Rolldown-Vite] Dev Toolbar closed");
    });

    hook.addTimelineEvent("custom", {
        data: { bundler: "Rolldown", framework: "React", message: "App mounted!" },
        id: "rolldown-mount",
        level: "info",
        time: Date.now(),
        title: "Rolldown-Vite + React Mounted",
    });
}
