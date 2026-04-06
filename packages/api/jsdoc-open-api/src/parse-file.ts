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
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const fileContent = readFileSync(file, { encoding: "utf8" });
    const extension = path.extname(file);

    if (extension === ".yaml" || extension === ".yml") {
        const spec = yaml.parse(fileContent);
        const invalidKeys = Object.keys(spec).filter((key) => !ALLOWED_KEYS.has(key));

        if (invalidKeys.length > 0) {
            const error = new ParseError(`Unexpected keys: ${invalidKeys.join(", ")}`);

            error.filePath = file;

            throw error;
        }

        if (Object.keys(spec).some((key) => ALLOWED_KEYS.has(key))) {
            const loc = yamlLoc(fileContent);

            return [{ loc, spec }];
        }

        return [];
    }

    try {
        return commentsToOpenApi(fileContent, verbose);
    } catch (error: any) {
        error.filePath = file;

        throw error;
    }
};

export default parseFile;
