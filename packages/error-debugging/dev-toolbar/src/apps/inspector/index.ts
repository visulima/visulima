import inspectIcon from "lucide-static/icons/inspect.svg?raw";

import type { DevToolbarApp } from "../../types/app";
import { startGlobalInspection, stopGlobalInspection } from "./inspector-app";

const inspectorApp: DevToolbarApp = {
    icon: inspectIcon,
    id: "dev-toolbar:inspector",
    name: "Inspector",

    onClick() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-underscore-dangle
        const api = (globalThis as any).__VISULIMA_DEVTOOLS__;

        startGlobalInspection(() => {
            // Cancelled via badge or Escape — deactivate the button
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
