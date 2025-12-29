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
    const content: any;

    export default content;
    export * from "*";
}
