// eslint-disable-next-line import/no-extraneous-dependencies
import { addVitePlugin, addWebpackPlugin, defineNuxtModule } from "@nuxt/kit";
import vite from "./vite";
import webpack from "./webpack";
import type { Options } from "./core/types.d";
// eslint-disable-next-line import/no-extraneous-dependencies
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
