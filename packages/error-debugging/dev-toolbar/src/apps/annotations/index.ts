// eslint-disable-next-line import/no-extraneous-dependencies
import messageSquarePlusIcon from "lucide-static/icons/message-square-plus.svg?raw";

import type { DevToolbarApp } from "../../types/app";
import AnnotationsApp from "./annotations-app";

const annotationsApp: DevToolbarApp = {
    component: AnnotationsApp,
    icon: messageSquarePlusIcon,
    id: "dev-toolbar:annotations",
    name: "Annotations",
};

export default annotationsApp;
