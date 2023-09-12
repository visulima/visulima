import { addVitePlugin, addWebpackPlugin, defineNuxtModule } from "@nuxt/kit";
import vite from "./vite";
import webpack from "./webpack";
import type { Options } from "./generator/types.d";
import "@nuxt/schema";

export type ModuleOptions = Options;

export default defineNuxtModule<ModuleOptions>({
    meta: {
        configKey: "openapi-jsdoc-compiler",
        name: "nuxt-openapi-jsdoc-compiler",
    },
    setup(options) {
        addVitePlugin(() => vite(options));
        addWebpackPlugin(() => webpack(options));
    },
});
