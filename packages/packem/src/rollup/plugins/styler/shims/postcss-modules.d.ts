declare module "postcss-modules-values" {
    import type { PluginCreator } from "postcss";

    const plugin: PluginCreator<unknown>;
    export default plugin;
}

declare module "postcss-modules-local-by-default" {
    import type { PluginCreator } from "postcss";

    export type Options = { mode?: "global" | "local" | "pure" };
    const plugin: PluginCreator<Options>;
    export default plugin;
}

declare module "postcss-modules-extract-imports" {
    import type { PluginCreator } from "postcss";

    export type Options = { failOnWrongOrder?: boolean };
    const plugin: PluginCreator<Options>;
    export default plugin;
}

declare module "postcss-modules-scope" {
    import type { PluginCreator } from "postcss";

    export type Options = {
        exportGlobals?: boolean;
        generateScopedName?: (name: string, file: string, css: string) => string;
    };
    const plugin: PluginCreator<Options>;
    export default plugin;
}
