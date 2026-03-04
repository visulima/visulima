// eslint-disable-next-line import/no-extraneous-dependencies
import folderOpenIcon from "lucide-static/icons/folder-open.svg?raw";

import type { DevToolbarApp } from "../../types/app";
import AssetsApp from "./assets-app";

const assetsApp: DevToolbarApp = {
    component: AssetsApp,
    icon: folderOpenIcon,
    id: "dev-toolbar:assets",
    name: "Assets",
};

export default assetsApp;
