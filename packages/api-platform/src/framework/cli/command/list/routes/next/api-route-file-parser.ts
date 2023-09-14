import { readFileSync } from "node:fs";
import process from "node:process";
import type { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import { parseLongSyntax, parseShortSyntax } from "@visulima/openapi-comment-parser";

import type { Route } from "../types.d";

// eslint-disable-next-line regexp/no-unused-capturing-group
const extensionRegex = /\.(js|ts|mjs|cjs)$/;

// eslint-disable-next-line sonarjs/cognitive-complexity
const apiRouteFileParser = (apiRouteFilePath: string, cwdPath: string, verbose = false): Route[] => {
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
                    file: apiRouteFilePath.replace(`${process.cwd()}${process.platform === "win32" ? "\\" : "/"}`, ""),
                    method: method as string,
                    path: apiRouteFilePath.replace(cwdPath, "").replace(extensionRegex, "").replaceAll("\\", "/"),
                    tags: [],
                });
            }
        });

        if (routes.length === 0) {
            routes.push({
                file: apiRouteFilePath.replace(`${process.cwd()}${process.platform === "win32" ? "\\" : "/"}`, ""),
                method: "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS",
                path: apiRouteFilePath.replace(cwdPath, "").replace(extensionRegex, "").replaceAll("\\", "/"),
                tags: [],
            });
        }

        return routes;
    }

    specs.forEach((spec) => {
        const paths = Object.entries(spec?.paths ?? {}) as [string, OpenAPIV3_1.PathItemObject | OpenAPIV3.PathItemObject][];

        paths.forEach(([path, pathSpec]) => {
            const methods = Object.entries(pathSpec);

            methods.forEach(([method, methodSpec]) => {
                routes.push({
                    file: apiRouteFilePath.replace(`${process.cwd()}${process.platform === "win32" ? "\\" : "/"}`, ""),
                    method: method.toUpperCase(),
                    path: path.replaceAll("\\", "/"),
                    tags: (methodSpec as OpenAPIV3.OperationObject)?.tags ?? [],
                });
            });
        });
    });

    return routes;
};

export default apiRouteFileParser;
