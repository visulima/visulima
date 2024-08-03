import { join } from "node:path";

import { resolve } from "@visulima/path";
import { isTest } from "std-env";
import { joinURL } from "ufo";
import { z } from "zod";

import app from "./app";
import build from "./build";
import common from "./common";
import development from "./dev";
import experimental from "./experimental";
import internal from "./internal";
import nitro from "./nitro";
import react from "./react";
import vite from "./vite";

const config = z
    .object({
        app,
        build,
        devServer: development,
        experimental,
        nitro,
        react,
        vite,
    })
    .extend(common.shape);

const transformBuildAnalyzer = (value: Record<string, unknown> | boolean, o: VisulimaConfig): Record<string, unknown> | boolean => {
    if (!value) {
        return false;
    }

    if (typeof value === "object") {
        return value;
    }

    return {
        filename: join(o.analyzeDir as string, "{name}.html"),
        projectRoot: o.rootDir,
        template: "treemap",
    };
};

config.transform(async (o) => {
    return {
        ...o,
        analyzeDir: o.analyzeDir ? resolve(o.rootDir, o.analyzeDir) : resolve(o.buildDir, "analyze"),
        app: {
            ...o.app,
            csr: o.app.csr || !o.app.ssr,
            ssr: o.app.ssr || !o.app.csr,
        },
        build: {
            ...o.build,
            analyze: transformBuildAnalyzer(o.build.analyze, o),
        },
        buildDir: resolve(o.rootDir, o.buildDir),
        ignore: [...o.ignore, o.buildDir, o.analyzeDir],
        nitro: {
            ...o.nitro,
            logLevel: o.nitro.logLevel === undefined ? o.nitro.logLevel : o.dev ? 3 : o.test ? 1 : 0,
        },
        vite: {
            ...o.vite,
            // eslint-disable-next-line require-unicode-regexp
            base: o.dev ? joinURL(o.app.baseURL.replace(/^\.\//, "/") || "/", o.app.buildAssetsDir) : "/",
            define: {
                ...o.vite.define,
                "import.meta.dev": o.dev,
                "import.meta.test": isTest,
                "process.dev": o.dev,
                "process.test": isTest,
            },
            mode: o.vite.mode ?? (o.dev ? "development" : "production"),
            server: {
                ...o.vite.server,
                fs: {
                    ...o.vite.server.fs,
                    allow: [o.buildDir, o.rootDir, ...o.vite.server.fs.allow],
                },
            },
        },
    };
});

const internalConfig = config.extend(internal.shape);

export type InternalVisulimaConfig = z.infer<typeof internalConfig>;

export const internalVisulimaSchema = internalConfig;

export type VisulimaConfig = z.infer<typeof config>;

export const visulimaSchema = config;
