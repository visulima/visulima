import type { DevToolbarApp } from "../../types/app";
import { TIMELINE_ICON } from "../../ui/icons/index";
import TimelineApp from "./timeline-app";

const timelineApp: DevToolbarApp = {
    component: TimelineApp,
    icon: TIMELINE_ICON,
    id: "dev-toolbar:timeline",
    name: "Timeline",
};

export default timelineApp;
