/**
 * Type declarations for virtual modules used by the dev toolbar
 */

declare module "virtual:visulima-dev-toolbar-options" {
    interface DevToolbarVirtualOptions {
        apps: {
            a11y: boolean;
            moduleGraph: boolean;
            performance: boolean;
            seo: boolean;
            settings: boolean;
            timeline: boolean;
            viteConfig: boolean;
        };
        base: string;
        closeOnOutsideClick: boolean;
        defaultVisible: boolean;
        height: number;
        keybindings: { close?: string; toggle?: string };
        minimizePanelInactive: number;
        placement: "bottom-left" | "bottom-center" | "bottom-right";
        position: "bottom" | "left" | "right" | "top";
        reduceMotion: boolean;
        requireUrlFlag: boolean;
        urlFlagName: string;
        width: number;
    }
    const options: DevToolbarVirtualOptions;

    export default options;
}

/**
 * Path-based virtual modules - resolved to actual dist files
 */
declare module "virtual:visulima-dev-toolbar-path:*" {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any;

    export default content;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export const a11yApp: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export const moduleGraphApp: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export const moreApp: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export const performanceApp: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export const seoApp: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export const settingsApp: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export const timelineApp: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export const viteConfigApp: any;
}

declare global {
    // eslint-disable-next-line no-var, @typescript-eslint/no-explicit-any
    var __VISULIMA_DEV_TOOLBAR_OPTIONS__: any;
    // eslint-disable-next-line no-var
    var __VISULIMA_DEVTOOLS_INITIALIZED__: boolean | undefined;
    // eslint-disable-next-line no-var, @typescript-eslint/no-explicit-any
    var __DEV_TOOLBAR_HOOK__: any;
    // eslint-disable-next-line no-var, @typescript-eslint/no-explicit-any
    var __VISULIMA_DEVTOOLS__: any;
}
