import { readFileSync } from "node:fs";
import path from "node:path";

import yaml from "yaml";

import type { OpenApiObject } from "./exported";
import yamlLoc from "./util/yaml-loc";

const ALLOWED_KEYS = new Set(["components", "externalDocs", "info", "openapi", "paths", "security", "servers", "tags"]);

class ParseError extends Error {
    public filePath?: string;
}

const parseFile = (
    file: string,
    commentsToOpenApi: (fileContent: string, verbose?: boolean) => { loc: number; spec: OpenApiObject }[],
    verbose?: boolean,
): { loc: number; spec: OpenApiObject }[] => {
    const fileContent = readFileSync(file, { encoding: "utf8" });
    const extension = path.extname(file);

    if (extension === ".yaml" || extension === ".yml") {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const spec = yaml.parse(fileContent);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const invalidKeys = Object.keys(spec).filter((key) => !ALLOWED_KEYS.has(key));

        if (invalidKeys.length > 0) {
            const error = new ParseError(`Unexpected keys: ${invalidKeys.join(", ")}`);

            error.filePath = file;

            throw error;
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        if (Object.keys(spec).some((key) => ALLOWED_KEYS.has(key))) {
            const loc = yamlLoc(fileContent);

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            return [{ loc, spec }];
        }

        return [];
    }

    try {
        return commentsToOpenApi(fileContent, verbose);
    } catch (error: unknown) {
        (error as ParseError).filePath = file;

        throw error;
    }
};

export default parseFile;
