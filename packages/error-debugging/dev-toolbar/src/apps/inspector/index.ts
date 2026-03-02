import inspectIcon from "lucide-static/icons/inspect.svg?raw";

import type { DevToolbarApp } from "../../types/app";
import InspectorApp from "./inspector-app";

const inspectorApp: DevToolbarApp = {
    component: InspectorApp,
    icon: inspectIcon,
    id: "dev-toolbar:inspector",
    name: "Inspector",
};

export default inspectorApp;
