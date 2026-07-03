// eslint-disable-next-line import/no-extraneous-dependencies
import gaugeIcon from "lucide-static/icons/gauge.svg?raw";

import type { DevToolbarApp } from "../../types/app";
import PerformanceApp from "./performance-app";
import PerformanceTooltip from "./performance-tooltip";

const performanceApp: DevToolbarApp = {
    component: PerformanceApp,
    icon: gaugeIcon,
    id: "dev-toolbar:performance",
    name: "Performance",
    tooltip: PerformanceTooltip,
};

export default performanceApp;
