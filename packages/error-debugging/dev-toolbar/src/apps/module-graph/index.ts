// eslint-disable-next-line import/no-extraneous-dependencies
import networkIcon from "lucide-static/icons/network.svg?raw";

import type { DevToolbarApp } from "../../types/app";
import ModuleGraphApp from "./module-graph-app";

const moduleGraphApp: DevToolbarApp = {
    component: ModuleGraphApp,
    icon: networkIcon,
    id: "dev-toolbar:module-graph",
    name: "Modules",
};

export default moduleGraphApp;
