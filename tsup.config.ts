import { join } from "path";
import { readFileSync, writeFileSync } from "fs";

import type { NormalizedPackageJson, NormalizeOptions } from "read-pkg";
import { readPackageSync } from "read-pkg";
import type { Options } from "tsup";
import { defineConfig as baseDefineConfig } from "tsup";

import tsconfig from "./tsconfig.base.json";

// This is a tsup plugin that convert exports.default to modules.exports for CommonJS modules.
const fixCjsExports = () => {
    return {
        buildEnd(result) {
            try {
                result.writtenFiles.forEach((file) => {
                    const filePath = join(process.cwd(), file.name);

                    if (file.name.endsWith(".cjs") || file.name.endsWith(".js")) {
                        // eslint-disable-next-line security/detect-non-literal-fs-filename
                        const content = readFileSync(filePath, "utf8");

                        if (!content.includes("exports.default")) {
                            return;
                        }

                        const newContent = content.replace(/(module\.)?exports\.default/g, "module.exports");

                        // eslint-disable-next-line security/detect-non-literal-fs-filename
                        writeFileSync(filePath, newContent, "utf8");
                    }
                });
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(error);
            }
        },
        name: "convert-default-to-module-exports",
    };
};

function getPackageSources(packageContent: NormalizedPackageJson):
    | string[]
    | {
          source: string;
          format: "esm" | "cjs";
      }[]
    | {
          cjs: string;
          esm: string;
      } {
    if (typeof packageContent["source"] === "string") {
        return [packageContent["source"]];
    }

    if (typeof packageContent["source"] === "object" && (packageContent["source"].cjs || packageContent["source"].esm)) {
        return packageContent["source"];
    }

    if (Array.isArray(packageContent["sources"])) {
        return packageContent["sources"];
    }

    throw new TypeError("Please define a source or sources key in the package.json.");
}

// @ts-ignore
export const createConfig = (
    config?:
        | (Options & Object)
        | {
              cjs?: Options & Object;
              esm?: Options & Object;
          },
) =>
    baseDefineConfig((options: Options) => {
        const packageJsonContent = readPackageSync(options as NormalizeOptions);

        const sources = getPackageSources(packageJsonContent);
        const peerDependenciesKeys = Object.keys(packageJsonContent?.peerDependencies || {});

        const baseConfig = {
            ...options,
            treeshake: true,
            // react external https://github.com/vercel/turborepo/issues/360#issuecomment-1013885148
            external: [
                ...new Set([
                    "index-browser.cjs",
                    "index-browser.mjs",
                    "index-server.cjs",
                    "index-server.mjs",
                    "react",
                    "@prisma/client",
                    "zod",
                    ...peerDependenciesKeys,
                    ...Object.keys(packageJsonContent?.optionalDependencies || {}),
                    ...((config as Options)?.external || []),
                ]),
            ],
            silent: !options.watch,
            minify: process.env["NODE_ENV"] === "production",
            minifyWhitespace: process.env["NODE_ENV"] === "production",
            incremental: !options.watch,
            dts: true,
            sourcemap: true,
            clean: true,
            splitting: true,
            shims: true,
            target: tsconfig.compilerOptions.target as "es2022",
            env: (config as Options)?.env ?? {
                NODE_ENV: process.env["NODE_ENV"],
            },
            declaration: true,
            esbuildOptions(options) {
                if (process.env["NODE_ENV"] !== "production" && peerDependenciesKeys.includes("react")) {
                    options.tsconfig = options.tsconfig?.replace("tsconfig.json", "tsconfig.dev.json");
                }

                options.logOverride = {
                    "tsconfig.json": "silent",
                    "this-is-undefined-in-esm": "silent",
                };
            },
        };

        if (Array.isArray(sources)) {
            if (sources.every((item) => typeof item === "string")) {
                return {
                    ...baseConfig,
                    plugins: [fixCjsExports()],
                    entry: sources,
                    format: ["esm", "cjs"],
                    cjsInterop: true,
                    ...(config as Options),
                };
            }

            return sources.map((obj) => {
                if (typeof obj === "string") {
                    return {
                        ...baseConfig,
                        plugins: [fixCjsExports()],
                        entry: [obj],
                        format: ["esm", "cjs"],
                        cjsInterop: true,
                        ...(config as Options),
                    };
                }

                const formatConfig = (config as Options)?.[obj.format];

                return {
                    ...baseConfig,
                    entry: [obj.source],
                    format: obj.format,
                    cjsInterop: true,
                    ...(formatConfig as Options),
                    plugins: [...(obj.format === "cjs" ? [fixCjsExports()] : []), ...((formatConfig as Options).plugins || [])],
                };
            });
        } else {
            return [
                {
                    ...baseConfig,
                    entry: [sources.cjs],
                    format: "cjs",
                    cjsInterop: true,
                    ...(config as { cjs: Options }).cjs,
                    plugins: [fixCjsExports(), ...((config as { cjs: Options }).cjs?.plugins || [])],
                },
                {
                    ...baseConfig,
                    entry: [sources.esm],
                    format: "esm",
                    ...(config as { esm: Options }).esm,
                },
            ];
        }
    });
