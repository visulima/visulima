import type { Plugin, ResolvedConfig } from "vite";
import { build, createDevServer, type Nitro, prepare } from "nitropack";

export const nitroPlugin = (config): Plugin[] => {
    let viteConfig: ResolvedConfig;
    let nitro: Nitro;

    return [
        {
            name: "vite-plugin-nitro",
            configResolved: (resolvedConfig) => {
                console.log("resolvedConfig", resolvedConfig);
            },
        },
    ];
};
