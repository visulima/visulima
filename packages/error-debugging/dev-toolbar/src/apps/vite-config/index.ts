// eslint-disable-next-line import/no-extraneous-dependencies
import zapIcon from "lucide-static/icons/zap.svg?raw";

import type { DevToolbarApp } from "../../types/app";
import ViteConfigApp from "./vite-config-app";

const viteConfigApp: DevToolbarApp = {
    component: ViteConfigApp,
    icon: zapIcon,
    id: "dev-toolbar:vite-config",
    name: "Vite Config",
};

export default viteConfigApp;
