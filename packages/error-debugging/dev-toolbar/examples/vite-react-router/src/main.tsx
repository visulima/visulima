import "./index.css";

import type { DevToolbarApp } from "@visulima/dev-toolbar";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";

import App from "./App.tsx";

createRoot(document.querySelector("#root")!).render(
    <StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </StrictMode>,
);

// ── Global DevTools API ───────────────────────────────────────────────────────

if (globalThis.window !== undefined && globalThis.__VISULIMA_DEVTOOLS__) {
    const exampleApp: DevToolbarApp = {
        icon: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm-1 13v-4H5l6-9v4h4l-6 9z" fill="currentColor"/></svg>',
        id: "react-router-example-app",
        init(canvas) {
            const wrapper = document.createElement("div");

            wrapper.style.cssText = "padding:16px;color:white;";

            const heading = document.createElement("h2");

            heading.style.cssText = "margin:0 0 8px";
            heading.textContent = "React Router Example";

            const desc = document.createElement("p");

            desc.style.cssText = "margin:0 0 12px;opacity:.7";
            desc.textContent = "Custom app registered in the React Router dev-toolbar demo.";

            const hint = document.createElement("p");

            hint.style.cssText = "font-size:12px;opacity:.5";
            hint.textContent = "Open the browser console to see hook events.";

            wrapper.append(heading, desc, hint);
            canvas.append(wrapper);
        },
        name: "React Router App",
    };

    globalThis.__VISULIMA_DEVTOOLS__.registerApp(exampleApp);
}

// ── Hook system ───────────────────────────────────────────────────────────────

if (globalThis.window !== undefined && globalThis.__DEV_TOOLBAR_HOOK__) {
    const hook = globalThis.__DEV_TOOLBAR_HOOK__;

    hook.on("devtools:init", () => {
        console.log("[React Router] Dev Toolbar initialized!");
    });

    hook.on("devtools:open", (appId: string) => {
        console.log(`[React Router] App opened: ${appId}`);
    });

    hook.on("devtools:close", () => {
        console.log("[React Router] Dev Toolbar closed");
    });

    hook.addTimelineEvent("custom", {
        data: { framework: "React Router", message: "App mounted!" },
        id: "react-router-mount",
        level: "info",
        time: Date.now(),
        title: "React Router App Mounted",
    });
}
