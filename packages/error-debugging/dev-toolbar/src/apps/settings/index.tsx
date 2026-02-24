import type { DevToolbarApp } from "../../types/app";
import { SETTINGS_ICON } from "../../ui/icons/index";
import SettingsApp from "./settings-app";

const settingsApp: DevToolbarApp = {
    component: SettingsApp,
    defaultOpen: true,
    icon: SETTINGS_ICON,
    id: "dev-toolbar:settings",
    name: "Settings",
};

export default settingsApp;
