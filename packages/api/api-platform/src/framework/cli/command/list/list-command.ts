import { execSync } from "node:child_process";
import { existsSync, rmSync, statSync } from "node:fs";
import process from "node:process";

import type { Server } from "@hapi/hapi";
import { extname, join } from "@visulima/path";
// eslint-disable-next-line e18e/ban-dependencies -- chalk is the established colored-output dep for this CLI; util.styleText migration is tracked separately
import chalk from "chalk";
// eslint-disable-next-line e18e/ban-dependencies -- type-only import; express is a supported integration target for the route-listing CLI
import type { Express } from "express";
import type { FastifyInstance } from "fastify";
import type Koa from "koa";

import { getRoutes } from "./get-routes";
import { installRouteCapture } from "./routes/express/express-path-parser";
import routesGroupBy from "./routes/routes-group-by";
import routesRender from "./routes/routes-render";
import type { Route } from "./routes/types";
import { ALLOWED_EXTENSIONS, getApp, getAppWorkingDirectoryPath, getFrameworkName } from "./utils";

interface RenderOptions {
    excludePaths: string[];
    group: string;
    includePaths: string[];
    methods: string[];
    verbose: boolean;
}

const listCommand = async (
    framework: "express" | "fastify" | "hapi" | "koa" | "next" | undefined,
    path: string,
    options: Partial<RenderOptions> = {},
    // eslint-disable-next-line sonarjs/cognitive-complexity
): Promise<void> => {
    const frameworkPath = join(process.cwd(), path);

    if (!existsSync(frameworkPath)) {
        throw new Error("No such file, invalid path provided.");
    }

    const appWorkingDirectoryPath = getAppWorkingDirectoryPath(frameworkPath);

    if (!appWorkingDirectoryPath) {
        throw new Error("Please initialize local package.json.");
    }

    if (framework === undefined) {
        const frameworkName = getFrameworkName(appWorkingDirectoryPath);

        if (!frameworkName) {
            throw new Error("Couldn't detect supported back-end framework.");
        }

        // eslint-disable-next-line no-param-reassign
        framework = frameworkName;
    }

    // eslint-disable-next-line unicorn/no-null -- public sentinel value for unsupported framework
    let routes: Route[] | null = null;

    if (framework === "next") {
        routes = await getRoutes(frameworkPath, "next", options.verbose ?? false);
    } else {
        if (!statSync(frameworkPath).isFile()) {
            throw new Error(`${frameworkPath} is directory, but file expected.`);
        }

        if (!ALLOWED_EXTENSIONS.includes(extname(frameworkPath))) {
            throw new Error("Please specify application .ts/.js/.mjs/.cjs file.");
        }

        const environmentFilePath = `${appWorkingDirectoryPath}/.env`;

        if (existsSync(environmentFilePath)) {
            // Loads environment vars in the current process so application
            // that depends on them can be loaded properly below

            // @ts-expect-error -- dotenv is not declared in this package's deps; it must be installed in the consuming project
            // eslint-disable-next-line e18e/ban-dependencies -- the consuming app spawns this CLI in a child process; --env-file is not available because env vars must be loaded into the same process
            const dotenv = (await import("dotenv")) as { config: (options: { path: string }) => unknown };

            dotenv.config({ path: environmentFilePath });
        }

        const isTypeScriptApp = extname(frameworkPath) === ".ts";
        const tscPath = join(appWorkingDirectoryPath, "node_modules/.bin/tsc");

        if (isTypeScriptApp && !existsSync(tscPath)) {
            throw new Error(`Please install typescript in ${appWorkingDirectoryPath}`);
        }

        try {
            if (isTypeScriptApp) {
                // || rm -r ./framework-list removes framework-list directory in case tsc fails

                try {
                    // eslint-disable-next-line sonarjs/os-command -- tscPath resolved from user's local node_modules; pre-existing CLI behavior
                    execSync(`${tscPath} --outDir framework-list >&2`, { cwd: appWorkingDirectoryPath });
                } catch (error) {
                    // eslint-disable-next-line no-console
                    console.log("TSC compilation failed. Please resolve issues in your project.\n");
                    // eslint-disable-next-line no-console
                    console.log(error);

                    rmSync(join(appWorkingDirectoryPath, "framework-list"), { recursive: true });
                }
            }

            const appJsFilePath = isTypeScriptApp
                ? join(appWorkingDirectoryPath, "framework-list", frameworkPath.replace(appWorkingDirectoryPath, "").replace(".ts", ".js"))
                : frameworkPath;

            const dynamicImport = new Function("path", "return import(path)") as (path: string) => Promise<{ default: unknown }>; // eslint-disable-line @typescript-eslint/no-implied-eval -- preserves dynamic import semantics in the CJS build target

            if (framework === "express") {
                // Express 5 discards declared mount paths once the app is built; capture them
                // at registration time before the user's app module attaches its routes.
                const { Router } = (await dynamicImport("express")) as unknown as { Router: Parameters<typeof installRouteCapture>[0] };

                installRouteCapture(Router);
            }

            const { default: defaultExport } = await dynamicImport(appJsFilePath);

            const app = ["AsyncFunction", "Function"].includes((defaultExport as Record<string, unknown>).constructor.name)
                ? await (defaultExport as () => Promise<unknown>)()
                : defaultExport;

            const appOrPath = getApp(app as Record<string, unknown>, framework);

            if (appOrPath !== null) {
                routes = await getRoutes(appOrPath as Express | FastifyInstance | Koa | Server | string, framework, options.verbose ?? false);
            }
        } finally {
            if (isTypeScriptApp) {
                rmSync(join(appWorkingDirectoryPath, "framework-list"), { recursive: true });
            }
        }
    }

    if (routes === null) {
        throw new Error(`Framework "${framework}" is not supported.`);
    }

    if (Array.isArray(options.includePaths) && options.includePaths.length > 0) {
        routes = options.includePaths.flatMap((ipath) => (routes as Route[]).filter((route) => route.path.startsWith(ipath)));
    }

    if (Array.isArray(options.excludePaths) && options.excludePaths.length > 0) {
        routes = options.excludePaths.flatMap((epath) => (routes as Route[]).filter((route) => !route.path.startsWith(epath)));
    }

    if (typeof options.group === "string" && options.group !== "") {
        // eslint-disable-next-line no-console
        console.log();

        const groupedMap = routesGroupBy(routes, (route) => {
            if (options.group === "path") {
                return route.path.replace("/pages", "").split("/")[1];
            }

            return route.tags[0] ?? "unsorted";
        });

        let counter = 0;

        groupedMap.forEach((groupedRoutes, key) => {
            if (counter > 0) {
                // eslint-disable-next-line no-console
                console.log();
            }

            const dotsCount = (process.stdout.columns - 16 - key.length) / 2;
            const dots = dotsCount > 0 ? Array.from({ length: dotsCount }).fill(" ").join("") : "";

            // eslint-disable-next-line no-console
            console.log(dots + chalk.bold.underline(key));

            routesRender(groupedRoutes, options).forEach((renderedRoute) => {
                // eslint-disable-next-line no-console
                console.log(renderedRoute);
            });

            counter += 1;
        });
    } else {
        // eslint-disable-next-line no-console
        console.log();

        routesRender(routes, options).forEach((renderedRoute) => {
            // eslint-disable-next-line no-console
            console.log(renderedRoute);
        });
    }

    // eslint-disable-next-line no-console
    console.log(`\n  Listed ${chalk.greenBright(String(routes.length))} HTTP ${routes.length === 1 ? "route" : "routes"}.\n`);
};

export default listCommand;
