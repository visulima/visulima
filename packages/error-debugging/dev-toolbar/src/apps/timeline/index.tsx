/**
 * Timeline app for viewing events
 * This is a placeholder - will be implemented with Preact components
 */

import type { DevToolbarApp } from "../../types/app";
import { TIMELINE_ICON } from "../../ui/icons/index";

export const timelineApp: DevToolbarApp = {
    icon: TIMELINE_ICON,
    id: "dev-toolbar:timeline",
    init(canvas, eventTarget, helpers) {
        // Tailwind styles are already injected by the toolbar
        // TODO: Implement timeline viewer with Preact
        const content = document.createElement("div");

        content.className = "p-4 text-white";
        content.innerHTML = "<h2 class=\"text-xl font-semibold mb-2\">Timeline</h2><p class=\"text-sm text-gray-300\">Timeline viewer coming soon...</p>";
        canvas.append(content);
    },
    name: "Timeline",
};
