import type { OpenApiObject } from "@visulima/jsdoc-open-api";
import { jsDocumentCommentsToOpenApi, parseFile, swaggerJsDocumentCommentsToOpenApi } from "@visulima/jsdoc-open-api";
import { readFileSync } from "node:fs";
import process from "node:process";

import type { Route } from "../types.d";

// eslint-disable-next-line regexp/no-unused-capturing-group
const extensionRegex = /\.(js|ts|mjs|cjs)$/;

// eslint-disable-next-line sonarjs/cognitive-complexity
const apiRouteFileParser = (apiRouteFile: string, cwdPath: string, verbose = false): Route[] => {
    let specs: OpenApiObject[] = [];

    const parsedJsDocumentFile = parseFile(apiRouteFile, jsDocumentCommentsToOpenApi, verbose);

    specs = [...specs, ...parsedJsDocumentFile.map((item) => item.spec)];

    const parsedSwaggerJsDocumentFile = parseFile(apiRouteFile, swaggerJsDocumentCommentsToOpenApi, verbose);

    specs = [...specs, ...parsedSwaggerJsDocumentFile.map((item) => item.spec)];

    const routes: Route[] = [];

    if (specs.length === 0) {
        const apiRouteFileContent = readFileSync(apiRouteFile, "utf8");

        apiRouteFileContent.split(/\r?\n/).forEach((line) => {
            const match = /[=aces|]+\s["'|](GET|POST|PUT|PATCH|HEAD|DELETE|OPTIONS)["'|]/.exec(line);

            if (match) {
                let [, method] = match;

                if (method === "GET") {
                    method = "GET|HEAD";
                }

                routes.push({
                    file: apiRouteFile.replace(`${process.cwd()}${process.platform === "win32" ? "\\" : "/"}`, ""),
                    method: method as string,
                    path: apiRouteFile.replace(cwdPath, "").replace(extensionRegex, "").replaceAll("\\", "/"),
                    tags: [],
                });
            }
        });

        if (routes.length === 0) {
            routes.push({
                file: apiRouteFile.replace(`${process.cwd()}${process.platform === "win32" ? "\\" : "/"}`, ""),
                method: "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS",
                path: apiRouteFile.replace(cwdPath, "").replace(extensionRegex, "").replaceAll("\\", "/"),
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
                    file: apiRouteFile.replace(`${process.cwd()}${process.platform === "win32" ? "\\" : "/"}`, ""),
                    method: method.toUpperCase(),
                    path: path.replaceAll("\\", "/"),
                    tags: methodSpec.tags,
                });
            });
        });
    });

    return routes;
};

export default apiRouteFileParser;
