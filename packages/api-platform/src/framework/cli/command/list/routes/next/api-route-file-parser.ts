import type { OpenApiObject } from "@visulima/jsdoc-open-api";
import { jsDocumentCommentsToOpenApi, parseFile, swaggerJsDocumentCommentsToOpenApi } from "@visulima/jsdoc-open-api";
import { readFileSync } from "node:fs";
import process from "node:process";

import type { Route } from "../types.d";

const extensionRegex = /\.(js|ts|mjs|cjs)$/;

const apiRouteFileParser = (apiRouteFile: string, cwdPath: string, verbose: boolean = false): Route[] => {
    let specs: OpenApiObject[] = [];

    const parsedJsDocumentFile = parseFile(apiRouteFile, jsDocumentCommentsToOpenApi, verbose);

    specs = [...specs, ...parsedJsDocumentFile.map((item) => item.spec)];

    const parsedSwaggerJsDocumentFile = parseFile(apiRouteFile, swaggerJsDocumentCommentsToOpenApi, verbose);

    specs = [...specs, ...parsedSwaggerJsDocumentFile.map((item) => item.spec)];

    const routes: Route[] = [];

    if (specs.length === 0) {
        const apiRouteFileContent = readFileSync(apiRouteFile, "utf8");

        apiRouteFileContent.split(/\r?\n/).forEach((line) => {
            const match = line.match(/[=aces|]+\s["'|](GET|POST|PUT|PATCH|HEAD|DELETE|OPTIONS)["'|]/);

            if (match) {
                let [, method] = match;

                if (method === "GET") {
                    method = "GET|HEAD";
                }

                routes.push({
                    method: method as string,
                    path: apiRouteFile.replace(cwdPath, "").replace(extensionRegex, ""),
                    tags: [],
                    file: apiRouteFile.replace(`${process.cwd()}/`, ""),
                });
            }
        });

        if (routes.length === 0) {
            routes.push({
                method: "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS",
                path: apiRouteFile.replace(cwdPath, "").replace(extensionRegex, ""),
                tags: [],
                file: apiRouteFile.replace(`${process.cwd()}/`, ""),
            });
        }

        return routes;
    }

    specs.forEach((spec) => {
        const paths = Object.entries(spec.paths);

        paths.forEach(([path, pathSpec]) => {
            const methods = Object.entries(pathSpec);

            methods.forEach(([method, methodSpec]) => {
                routes.push({
                    path, method: method.toUpperCase(), tags: methodSpec.tags, file: apiRouteFile.replace(`${process.cwd()}/`, ""),
                });
            });
        });
    });

    return routes;
};

export default apiRouteFileParser;
