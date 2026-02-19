/**
 * Type declarations for virtual modules used by the dev toolbar
 */

declare module "virtual:visulima-dev-toolbar-options" {
    interface DevToolbarVirtualOptions {
        apps: {
            settings: boolean;
            timeline: boolean;
        };
        base: string;
        defaultVisible: boolean;
        placement: "bottom-left" | "bottom-center" | "bottom-right";
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
    export const moreApp: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export const settingsApp: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export const timelineApp: any;
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
