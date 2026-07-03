// eslint-disable-next-line import/no-extraneous-dependencies
import searchIcon from "lucide-static/icons/search.svg?raw";

import type { DevToolbarApp } from "../../types/app";
import SeoApp from "./seo-app";

const seoApp: DevToolbarApp = {
    component: SeoApp,
    icon: searchIcon,
    id: "dev-toolbar:seo",
    name: "SEO",
};

export default seoApp;
