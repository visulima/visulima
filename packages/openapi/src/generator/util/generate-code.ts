import { exit } from "node:process";
import cliProgress from "cli-progress";
import chalk from "chalk";
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { parseLongSyntax, parseShortSyntax } from "@visulima/openapi-comment-parser";
import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import safeStringify from "fast-safe-stringify";
import { dereferenceSync } from "dereference-json-schema";

import SpecBuilder from "../spec-builder";
import parseYaml from "./parse-yaml";
import validator from "../../validator";

const generateCode = async (
    foundFiles: ReadonlyArray<string>,
    swaggerDefinition: Partial<OpenAPIV2.Document> | Partial<OpenAPIV3_1.Document> | Partial<OpenAPIV3.Document>,
    verbose: boolean,
    stopOnInvalid: boolean,
    // eslint-disable-next-line sonarjs/cognitive-complexity
): Promise<string | undefined> => {
    const spec = new SpecBuilder(swaggerDefinition);

    const singleBar = new cliProgress.SingleBar(
        {
            clearOnComplete: false,
            format: `{value}/{total} | ${chalk.green("{bar}")} | {filename}`,
            hideCursor: true,
        },
        cliProgress.Presets.shades_grey,
    );

    singleBar.start(foundFiles.length, 0);

    foundFiles.forEach((filePath) => {
        if (verbose) {
            // eslint-disable-next-line no-console
            console.log(`Parsing file ${filePath}`);
        }

        singleBar.increment(1, { filename: filePath });

        const extension = extname(filePath);
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const content = readFileSync(filePath, { encoding: "utf8" });

        try {
            if ([".yaml", ".yml"].includes(extension)) {
                const parsedYaml = parseYaml(content);

                if (typeof parsedYaml === "object") {
                    spec.addData(parsedYaml.spec);
                }
            } else if ([".cjs", ".cts", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"].includes(extension)) {
                const parsedShortJsDocumentFile = parseShortSyntax(content);

                parsedShortJsDocumentFile.forEach(({ spec: data }) => {
                    spec.addData(data as OpenAPIV3_1.Document | OpenAPIV3.Document);
                });

                const parsedLongJsDocumentFile = parseLongSyntax(content);

                parsedLongJsDocumentFile.forEach(({ spec: data }) => {
                    spec.addData(data as OpenAPIV2.Document | OpenAPIV3_1.Document | OpenAPIV3.Document);
                });
            } else if (extension === ".json") {
                const parsedJson = JSON.parse(content);

                if (typeof parsedJson === "object" && (parsedJson.openapi || parsedJson.swagger)) {
                    spec.addData(parsedJson);
                }
            }
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error(error);

            if (stopOnInvalid) {
                exit(1);
            }
        }
    });

    singleBar.stop();

    try {
        // eslint-disable-next-line no-console
        console.log("\nResolving OpenApi spec $ref values...");

        const resolvedSpec = dereferenceSync(spec);

        // eslint-disable-next-line no-console
        console.log("\nValidating OpenApi spec...");

        const specString = safeStringify(resolvedSpec, undefined, 2);

        if (verbose) {
            // eslint-disable-next-line no-console
            console.log(`\n${specString}\n`);
        }

        await validator(JSON.parse(specString));

        // eslint-disable-next-line no-console
        console.log("\nOpenApi spec is valid\n");

        return specString;
    } catch (error: any) {
        // eslint-disable-next-line no-console
        console.error(error);

        if (stopOnInvalid) {
            exit(1);
        }

        return undefined;
    }
};

export default generateCode;
