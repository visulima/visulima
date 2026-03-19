// eslint-disable-next-line import/no-extraneous-dependencies
import inspectIcon from "lucide-static/icons/inspect.svg?raw";

import { detachMarkdownShortcut, removeAllMarkers } from "./annotation-overlay";
import type { DevToolbarApp } from "../../types/app";
import { startGlobalInspection, stopGlobalInspection } from "./inspector-app";

const inspectorApp: DevToolbarApp = {
    icon: inspectIcon,
    id: "dev-toolbar:inspector",
    name: "Inspector",

    onClick() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-underscore-dangle
        const api = (globalThis as any).__VISULIMA_DEVTOOLS__;

        startGlobalInspection(async () => {
            // Cancelled via badge or Escape — cleanup() already ran (removed
            // listeners/overlay/badge), so we just need to handle annotations
            // and deactivate the toolbar button.
            removeAllMarkers();
            detachMarkdownShortcut();

            // Close annotations panel if open — await to avoid render race
            if (api?.getActiveApp?.() === "dev-toolbar:annotations") {
                try {
                    await api.closeApp?.();
                } catch {
                    /* ignore */
                }
            }

            // Deactivate the inspector button in the toolbar
            if (api?.setAppActive) {
                api.setAppActive("dev-toolbar:inspector", false);
            }
        });
    },

    onDeactivate() {
        // Button clicked while active — cancel the in-progress inspection
        stopGlobalInspection();
    },
};

export default inspectorApp;
