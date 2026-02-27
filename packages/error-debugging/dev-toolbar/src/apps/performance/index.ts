import type { DevToolbarApp } from "../../types/app";
import PerformanceApp from "./performance-app";
import PerformanceTooltip from "./performance-tooltip";

// Gauge / speedometer icon — represents performance measurement
const PERFORMANCE_ICON =
    '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.5 13A7 7 0 1 1 16.5 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M10 13L13 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="10" cy="13" r="1.25" fill="currentColor"/><path d="M6.5 13H5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/><path d="M15 13H13.5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/><path d="M10 6.5V5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/></svg>';

const performanceApp: DevToolbarApp = {
    component: PerformanceApp,
    icon: PERFORMANCE_ICON,
    id: "dev-toolbar:performance",
    name: "Performance",
    tooltip: PerformanceTooltip,
};

export default performanceApp;
