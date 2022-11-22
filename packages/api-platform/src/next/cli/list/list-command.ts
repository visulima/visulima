// eslint-disable-next-line import/no-extraneous-dependencies
import colors from "chalk";
import { join } from "node:path";
import process from "node:process";

import apiRouteFileParser from "./api-route-file-parser";
import collectApiRouteFiles from "./collect-api-route-files";
import routesRender from "./routes-render";
import type { Route } from "./types";

type RenderOptions = {
    includePaths: string[];
    excludePaths: string[];
    methods: string[];
    group: string;
};

const groupBy = (list: Route[], keyGetter: (item: Route) => keyof Route): Map<string, Route[]> => {
    const map = new Map();

    list.forEach((item) => {
        const key = keyGetter(item);
        const collection = map.get(key);

        if (collection) {
            collection.push(item);
        } else {
            map.set(key, [item]);
        }
    });

    return map;
};

const listCommand = async (
    path: string = "",
    options: Partial<
    {
        verbose: boolean;
    } & RenderOptions
    > = {},
// eslint-disable-next-line radar/cognitive-complexity
) => {
    const routePath = join(process.cwd(), path);

    const apiRouteFiles = await collectApiRouteFiles(routePath, options.verbose || false);

    if (apiRouteFiles.length === 0) {
        // eslint-disable-next-line no-console
        console.error(`No API routes found, in "${routePath}".`);
        // eslint-disable-next-line unicorn/no-process-exit
        process.exit(1);
    }

    let parsedApiRoutes = apiRouteFiles.flatMap((apiRouteFile) => apiRouteFileParser(apiRouteFile, routePath, options.verbose || false));

    if (options.includePaths) {
        parsedApiRoutes = options.includePaths.flatMap((ipath) => parsedApiRoutes.filter((route) => route.path.startsWith(ipath)));
    }

    if (options.excludePaths) {
        parsedApiRoutes = options.excludePaths.flatMap((epath) => parsedApiRoutes.filter((route) => !route.path.startsWith(epath)));
    }

    if (options.group === undefined) {
        routesRender([], options).forEach((renderedRoute) => {
            // eslint-disable-next-line no-console
            console.log(renderedRoute);
        });
    } else {
        const groupedMap = groupBy(parsedApiRoutes, (route) => {
            if (options.group === "path") {
                return route.path.replace("/pages", "").split("/")[1];
            }

            return route.tags[0] || "unsorted";
        });

        let counter = 0;

        groupedMap.forEach((routes, key) => {
            if (counter > 0) {
                // eslint-disable-next-line no-console
                console.log();
            }

            const dotsCount = (process.stdout.columns - 16 - key.length) / 2;
            const dots = dotsCount > 0 ? Array.from({ length: dotsCount }).fill(" ").join("") : "";
            // eslint-disable-next-line no-console
            console.log(dots + colors.bold.underline(key));

            routesRender(routes, options).forEach((renderedRoute) => {
                // eslint-disable-next-line no-console
                console.log(renderedRoute);
            });

            counter += 1;
        });
    }
    // });

    // eslint-disable-next-line no-console
    console.log(`\n  Listed ${colors.greenBright(String(apiRouteFiles.length))} HTTP ${apiRouteFiles.length === 1 ? "route" : "routes"}.\n`);
};

export default listCommand;
