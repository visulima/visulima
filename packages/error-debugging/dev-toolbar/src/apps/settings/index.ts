/**
 * Settings app for dev toolbar
 * This is a placeholder - will be implemented with Preact components
 */

import type { DevToolbarApp } from "../../types/app";
import { SETTINGS_ICON } from "../../ui/icons/index";

const settingsApp: DevToolbarApp = {
    icon: SETTINGS_ICON,
    id: "dev-toolbar:settings",
    init(canvas, eventTarget, helpers) {
        // Tailwind styles are already injected by the toolbar
        // TODO: Implement settings UI with Preact
        const content = document.createElement("div");

        content.className = "p-4 text-white";
        content.innerHTML = '<h2 class="text-xl font-semibold mb-2">Settings</h2><p class="text-sm text-gray-300">Settings panel coming soon...</p>';
        canvas.append(content);
    },
    name: "Settings",
};

export default settingsApp;
