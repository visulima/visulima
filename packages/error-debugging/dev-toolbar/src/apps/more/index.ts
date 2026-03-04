// eslint-disable-next-line import/no-extraneous-dependencies
import moreHorizontalIcon from "lucide-static/icons/more-horizontal.svg?raw";

import type { DevToolbarApp } from "../../types/app";
import MoreApp from "./more-app";

const moreApp: DevToolbarApp = {
    component: MoreApp,
    icon: moreHorizontalIcon,
    id: "dev-toolbar:more",
    name: "More",
};

export default moreApp;
