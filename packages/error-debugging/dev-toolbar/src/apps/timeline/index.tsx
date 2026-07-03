// eslint-disable-next-line import/no-extraneous-dependencies
import ganttChartIcon from "lucide-static/icons/gantt-chart.svg?raw";

import { startTimelineCapture } from "../../timeline/capture";
import type { DevToolbarApp } from "../../types/app";
import TimelineApp from "./timeline-app";

// Begin capturing events as soon as this module is loaded (before the panel is opened)
startTimelineCapture();

const timelineApp: DevToolbarApp = {
    component: TimelineApp,
    icon: ganttChartIcon,
    id: "dev-toolbar:timeline",
    name: "Timeline",
};

export default timelineApp;
