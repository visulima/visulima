import type { DevToolbarApp } from "../../types/app";
import ViteConfigApp from "./vite-config-app";

const VITE_CONFIG_ICON =
    '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 2L3 7.5V17H17V7.5L10 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M10 7L7 12H10L9 17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const viteConfigApp: DevToolbarApp = {
    component: ViteConfigApp,
    icon: VITE_CONFIG_ICON,
    id: "dev-toolbar:vite-config",
    name: "Vite Config",
};

export default viteConfigApp;
