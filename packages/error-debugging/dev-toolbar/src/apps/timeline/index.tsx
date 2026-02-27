import ganttChartIcon from "lucide-static/icons/gantt-chart.svg?raw";

import type { DevToolbarApp } from "../../types/app";
import TimelineApp from "./timeline-app";

const timelineApp: DevToolbarApp = {
    component: TimelineApp,
    icon: ganttChartIcon,
    id: "dev-toolbar:timeline",
    name: "Timeline",
};

export default timelineApp;
