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
 * Path-based virtual modules - resolved to actual dist files.
 * Each app module has a default export (the DevToolbarApp object).
 */
declare module "virtual:visulima-dev-toolbar-path:*" {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any;

    export default content;
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
