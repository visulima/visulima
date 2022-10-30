import colors from "chalk";

import type { Route } from "./types";

const renderRoute = (method: string, routePath: string): string => {
    const colorMap = {
        GET: colors.blue,
        POST: colors.yellow,
        PATCH: colors.yellow,
        PUT: colors.yellow,
        DELETE: colors.redBright,
        OPTIONS: colors.hex("#6C7280"),
        ANY: colors.redBright,
        HEAD: colors.hex("#6C7280"),
    };

    let methodText: string;

    if (method === "GET|HEAD") {
        methodText = `${colors.blue("GET")}${colors.grey("|HEAD")}`;
    } else {
        const coloredMethod = colorMap[method as keyof typeof colorMap](method);

        methodText = method === "GET" ? `${coloredMethod}${colors.grey("|HEAD")}` : coloredMethod;
    }

    const spacesCount = method === "GET" ? 6 : 14 - method.length;
    const spaces = Array.from({ length: spacesCount }).fill(" ").join("");

    const dotsCount = process.stdout.columns - 16 - routePath.length - 4;
    const dots = dotsCount > 0 ? Array.from({ length: dotsCount }).fill(".").join("") : "";

    const routeText = routePath
        .split("/")
        .map((segment) => {
            const isDynamicSegment = ["[", ":"].includes(segment[0] || "");

            return isDynamicSegment ? colors.yellowBright(segment) : segment;
        })
        .join("/");

    return `  ${methodText}${spaces}${routeText}${colors.grey(dots)}`;
};

const routesRender = (routesMap: Route[], options: { methods?: string[]; } = {}) => routesMap
    .map((route) => {
        if (options.methods && options.methods.includes(route.method)) {
            return;
        }

        if (route.method === "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS") {
            // eslint-disable-next-line no-param-reassign
            route.method = "ANY";
        }

        // eslint-disable-next-line consistent-return
        return renderRoute(route.method, route.path.replace("/pages", ""));
    })
    .filter(Boolean);

export default routesRender;
