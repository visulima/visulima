import { execSync } from "node:child_process";
import { existsSync, rmSync, statSync } from "node:fs";
import process from "node:process";

import { extname, join } from "@visulima/path";
import chalk from "chalk";

import { getRoutes } from "./get-routes";
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
            const dotEnvironmentFilePath = `${appWorkingDirectoryPath}/node_modules/dotenv/lib/main.js`;
            const dotenv = await import(dotEnvironmentFilePath);

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
                    execSync(`${tscPath} --outDir framework-list >&2`, { cwd: appWorkingDirectoryPath });
                } catch (error: any) {
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

            const { default: defaultExport } = await import(appJsFilePath);

            routes = await getRoutes(
                ["AsyncFunction", "Function"].includes(defaultExport.constructor.name as string) ? await defaultExport() : getApp(defaultExport, framework),
                framework,
                options.verbose ?? false,
            );
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
