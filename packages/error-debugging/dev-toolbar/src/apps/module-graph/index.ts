import type { DevToolbarApp } from "../../types/app";
import ModuleGraphApp from "./module-graph-app";

const MODULE_GRAPH_ICON =
    '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="3" r="2" stroke="currentColor" stroke-width="1.4"/><circle cx="3" cy="17" r="2" stroke="currentColor" stroke-width="1.4"/><circle cx="17" cy="17" r="2" stroke="currentColor" stroke-width="1.4"/><path d="M10 5L3 15M10 5L17 15M3 15H17" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';

const moduleGraphApp: DevToolbarApp = {
    component: ModuleGraphApp,
    icon: MODULE_GRAPH_ICON,
    id: "dev-toolbar:module-graph",
    name: "Modules",
};

export default moduleGraphApp;
