// eslint-disable-next-line import/no-extraneous-dependencies
import layoutIcon from "lucide-static/icons/layout-template.svg?raw";

import type { DevToolbarApp } from "../../types/app";
import { unmountLayoutModeOverlay } from "./overlay-mount";
import LayoutModeApp from "./layout-mode-app";
import { resetLayoutMode } from "./store";

const layoutModeApp: DevToolbarApp = {
    component: LayoutModeApp,
    destroy() {
        unmountLayoutModeOverlay();
        resetLayoutMode();
    },
    icon: layoutIcon,
    id: "dev-toolbar:layout-mode",
    name: "Layout Mode",
};

export default layoutModeApp;
