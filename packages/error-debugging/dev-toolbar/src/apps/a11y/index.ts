// eslint-disable-next-line import/no-extraneous-dependencies
import accessibilityIcon from "lucide-static/icons/accessibility.svg?raw";

import type { DevToolbarApp } from "../../types/app";
import A11yApp from "./a11y-app";
import A11yTooltip from "./a11y-tooltip";

const a11yApp: DevToolbarApp = {
    component: A11yApp,
    icon: accessibilityIcon,
    id: "dev-toolbar:a11y",
    name: "Accessibility",
    tooltip: A11yTooltip,
};

export default a11yApp;
