import { readFileSync } from "node:fs";
import path from "node:path";

import type { Block } from "comment-parser";
import { parse as parseComments } from "comment-parser";
import yaml from "yaml";

import type { OpenApiObject } from "./exported";
import yamlLoc from "./util/yaml-loc";

const ALLOWED_KEYS = new Set(["components", "externalDocs", "info", "openapi", "paths", "security", "servers", "tags"]);

class ParseError extends Error {
    public filePath?: string;
}

/**
 * A comment-to-OpenAPI translator. The optional `comments` argument lets the
 * caller pass already-parsed JSDoc blocks so a file's comments only have to be
 * parsed once even when multiple translators run over the same file.
 */
// eslint-disable-next-line import/exports-last
export type CommentsToOpenApi = (fileContent: string, verbose?: boolean, comments?: Block[]) => { loc: number; spec: OpenApiObject }[];

const YAML_EXTENSIONS = new Set([".yaml", ".yml"]);

const parseYamlFile = (file: string, fileContent: string): { loc: number; spec: OpenApiObject }[] => {
    const spec = yaml.parse(fileContent);

    if (spec === null || typeof spec !== "object") {
        return [];
    }

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
};

const parseFile = (file: string, commentsToOpenApi: CommentsToOpenApi, verbose?: boolean): { loc: number; spec: OpenApiObject }[] => {
    const fileContent = readFileSync(file, { encoding: "utf8" });
    const extension = path.extname(file);

    if (YAML_EXTENSIONS.has(extension)) {
        return parseYamlFile(file, fileContent);
    }

    try {
        return commentsToOpenApi(fileContent, verbose);
    } catch (error: any) {
        error.filePath = file;

        throw error;
    }
};

/**
 * Read and parse a file once, feeding the result of a single `comment-parser`
 * pass to every supplied translator. Avoids the double `readFileSync`/
 * `parseComments`/`yaml.parse` that calling {@link parseFile} once per dialect
 * incurs.
 * @returns the concatenated results of every translator (YAML files yield a
 * single result regardless of how many translators are passed).
 */
export const parseFileMulti = (file: string, translators: CommentsToOpenApi[], verbose?: boolean): { loc: number; spec: OpenApiObject }[] => {
    const fileContent = readFileSync(file, { encoding: "utf8" });
    const extension = path.extname(file);

    if (YAML_EXTENSIONS.has(extension)) {
        return parseYamlFile(file, fileContent);
    }

    // Parse the JSDoc blocks a single time and share them with every dialect.
    const comments = parseComments(fileContent, { spacing: "preserve" });

    const results: { loc: number; spec: OpenApiObject }[] = [];

    for (const translator of translators) {
        try {
            results.push(...translator(fileContent, verbose, comments));
        } catch (error: any) {
            error.filePath = file;

            throw error;
        }
    }

    return results;
};

export default parseFile;
