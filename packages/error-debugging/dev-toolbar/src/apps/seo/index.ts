import type { DevToolbarApp } from "../../types/app";
import SeoApp from "./seo-app";

const SEO_ICON =
    '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="9" cy="9" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M13.5 13.5L17.5 17.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M6 9H12M9 6V12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';

const seoApp: DevToolbarApp = {
    component: SeoApp,
    icon: SEO_ICON,
    id: "dev-toolbar:seo",
    name: "SEO",
};

export default seoApp;
