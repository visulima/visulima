import { lstat, mkdir, realpath, writeFile } from "node:fs/promises";
import { dirname, normalize } from "node:path";
import { pathToFileURL } from "node:url";

import { collect } from "@visulima/fs";
// eslint-disable-next-line import/no-extraneous-dependencies
import { MultiBar, Presets } from "cli-progress";

import { DEFAULT_EXCLUDE } from "../../constants";
import type { BaseDefinition } from "../../exported";
import jsDocumentCommentsToOpenApi from "../../jsdoc/comments-to-open-api";
import parseFile from "../../parse-file";
import SpecBuilder from "../../spec-builder";
import swaggerJsDocumentCommentsToOpenApi from "../../swagger-jsdoc/comments-to-open-api";
import validate from "../../validate";

const generateCommand = async (
    configName: string,
    paths: string[],
    options: {
        config?: string;
        output?: string;
        verbose?: boolean;
        veryVerbose?: boolean;
    },
): Promise<void> => {
    type OpenApiConfig = {
        exclude: string[];
        extensions?: string[];
        followSymlinks?: boolean;
        include?: (RegExp | string)[];
        swaggerDefinition: BaseDefinition;
    };

    let openapiConfig: OpenApiConfig;

    try {
        let config = await import(pathToFileURL(normalize(options.config ?? configName)).href);

        if (config?.default) {
            config = config.default;
        }

        openapiConfig = config;
    } catch {
        throw new Error(`No config file found, on: ${options.config ?? ".openapirc.js"}\n`);
    }

    const multibar = new MultiBar(
        {
            clearOnComplete: false,
            format: "{value}/{total} | {bar} | {filename}",
            hideCursor: true,
        },
        Presets.shades_grey,
    );

    const spec = new SpecBuilder(openapiConfig.swaggerDefinition);
    const skip = new Set<RegExp | string>([...DEFAULT_EXCLUDE, ...openapiConfig.exclude]);

    // eslint-disable-next-line unicorn/prevent-abbreviations
    for (const dir of paths) {
        // Check if the path is a directory
        // eslint-disable-next-line unicorn/no-await-expression-member,no-await-in-loop
        (await lstat(dir)).isDirectory();

        // eslint-disable-next-line no-await-in-loop
        const realDirectory = await realpath(dir);

        // eslint-disable-next-line no-await-in-loop
        const files: string[] = await collect(realDirectory, {
            extensions: openapiConfig.extensions ?? [".js", ".cjs", ".mjs", ".ts", ".tsx", ".jsx", ".yaml", ".yml"],
            followSymlinks: openapiConfig.followSymlinks ?? false,
            match: openapiConfig.include,
            skip: [...skip],
        });

        if (options.verbose ?? options.veryVerbose) {
            // eslint-disable-next-line no-console
            console.log(`\nFound ${String(files.length)} files in ${realDirectory}`);
        }

        if (options.veryVerbose) {
            // eslint-disable-next-line no-console
            console.log(files);
        }

        const bar = multibar.create(files.length, 0);

        files.forEach((file) => {
            if (options.verbose) {
                // eslint-disable-next-line no-console
                console.log(`Parsing file ${file}`);
            }

            bar.increment(1, { filename: realDirectory });

            const parsedJsDocumentFile = parseFile(file, jsDocumentCommentsToOpenApi, options.verbose);

            spec.addData(parsedJsDocumentFile.map((item) => item.spec));

            const parsedSwaggerJsDocumentFile = parseFile(file, swaggerJsDocumentCommentsToOpenApi, options.verbose);

            spec.addData(parsedSwaggerJsDocumentFile.map((item) => item.spec));
        });
    }

    if (options.verbose) {
        // eslint-disable-next-line no-console
        console.log("Validating swagger spec");
    }

    if (options.veryVerbose) {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(spec, undefined, 2));
    }

    await validate(structuredClone(spec) as unknown as Record<string, unknown>);

    const output = options.output ?? "swagger.json";

    multibar.stop();

    if (options.verbose) {
        // eslint-disable-next-line no-console
        console.log(`Written swagger spec to "${output}" file`);
    }

    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, JSON.stringify(spec, undefined, 2));

    // eslint-disable-next-line no-console
    console.log(`\nSwagger specification is ready, check the "${output}" file.`);
};

export default generateCommand;
