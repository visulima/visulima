import { readFileSync } from "node:fs";
import { cwd as nodeCwd } from "node:process";

import type { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import { parseLongSyntax, parseShortSyntax } from "@visulima/openapi-comment-parser";
import { toNamespacedPath } from "pathe";

import type { Route } from "../types";

// eslint-disable-next-line regexp/no-unused-capturing-group
const extensionRegex = /\.(js|ts|mjs|cjs)$/;

// eslint-disable-next-line sonarjs/cognitive-complexity
const apiRouteFileParser = (apiRouteFilePath: string, cwdPath: string, verbose = false): Route[] => {
    // eslint-disable-next-line no-param-reassign
    apiRouteFilePath = toNamespacedPath(apiRouteFilePath);

    const cwdPath = toNamespacedPath(nodeCwd());

    let specs: (OpenAPIV3_1.Document | OpenAPIV3.Document)[] = [];

    const content = readFileSync(apiRouteFilePath, { encoding: "utf8" });

    const parsedJsDocumentFile = parseShortSyntax(content, verbose);

    specs = [...specs, ...parsedJsDocumentFile.map((item) => item.spec)];

    const parsedOpenapiJsDocumentFile = parseLongSyntax(content, verbose);

    specs = [...specs, ...parsedOpenapiJsDocumentFile.map((item) => item.spec)];

    const routes: Route[] = [];

    if (specs.length === 0) {
        content.split(/\r?\n/).forEach((line) => {
            const match = /[=aces|]+\s["'|](GET|POST|PUT|PATCH|HEAD|DELETE|OPTIONS)["'|]/.exec(line);

            if (match) {
                let [, method] = match;

                if (method === "GET") {
                    method = "GET|HEAD";
                }

                routes.push({
                    file: content.replace(`${cwdPath}/`, ""),
                    method: method as string,
                    path: toNamespacedPath(content.replace(cwdPath, "").replace(extensionRegex, "")),
                    tags: [],
                });
            }
        });

        if (routes.length === 0) {
            routes.push({
                file: content.replace(`${cwdPath}/`, ""),
                method: "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS",
                path: toNamespacedPath(content.replace(cwdPath, "").replace(extensionRegex, "")),
                tags: [],
            });
        }

        return routes;
    }

    specs.forEach((spec) => {
        const paths = Object.entries(spec?.paths ?? {});

        paths.forEach(([path, pathSpec]) => {
            const methods = Object.entries(pathSpec);

            methods.forEach(([method, methodSpec]) => {
                routes.push({
                    file: content.replace(`${cwdPath}/`, ""),
                    method: method.toUpperCase(),
                    path: toNamespacedPath(path),
                    tags: methodSpec.tags,
                });
            });
        });
    });

    return routes;
};

export default apiRouteFileParser;
