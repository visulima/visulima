// eslint-disable-next-line import/no-extraneous-dependencies
import settingsIcon from "lucide-static/icons/settings.svg?raw";

import type { DevToolbarApp } from "../../types/app";
import SettingsApp from "./settings-app";

const settingsApp: DevToolbarApp = {
    component: SettingsApp,
    defaultOpen: true,
    icon: settingsIcon,
    id: "dev-toolbar:settings",
    name: "Settings",
};

export default settingsApp;
