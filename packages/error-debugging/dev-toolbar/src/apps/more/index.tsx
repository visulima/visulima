import type { DevToolbarApp } from "../../types/app";
import { MORE_ICON } from "../../ui/icons/index";
import MoreApp from "./more-app";

const moreApp: DevToolbarApp = {
    component: MoreApp,
    icon: MORE_ICON,
    id: "dev-toolbar:more",
    name: "More",
};

export default moreApp;
