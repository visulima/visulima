/**
 * More apps dropdown
 * This is a placeholder - will be implemented with Preact components
 */

import type { DevToolbarApp } from "../../types/app";
import { MORE_ICON } from "../../ui/icons/index";

const moreApp: DevToolbarApp = {
    icon: MORE_ICON,
    id: "dev-toolbar:more",
    init(canvas, eventTarget, helpers) {
        // Tailwind styles are already injected by the toolbar
        // TODO: Implement more apps dropdown with Preact
        const content = document.createElement("div");

        content.className = "p-4 text-white";
        content.innerHTML = '<h2 class="text-xl font-semibold mb-2">More Apps</h2><p class="text-sm text-gray-300">More apps panel coming soon...</p>';
        canvas.append(content);
    },
    name: "More",
};

export default moreApp;
