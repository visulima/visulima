import { lstat, mkdir, realpath, writeFile } from "node:fs/promises";
import { dirname, normalize } from "node:path";
import { pathToFileURL } from "node:url";

import type { WalkOptions } from "@visulima/fs";
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
    let openapiConfig: {
        exclude: string[];
        extensions?: string[];
        followSymlinks?: boolean;
        include?: (RegExp | string)[];
        swaggerDefinition: BaseDefinition;
    };

    try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        let config = await import(pathToFileURL(normalize(options.config ?? configName)).href);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (config?.default) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
            config = config.default;
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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

    // eslint-disable-next-line unicorn/prevent-abbreviations,no-for-of-array/no-for-of-array
    for (const dir of paths) {
        // Check if the path is a directory
        // eslint-disable-next-line unicorn/no-await-expression-member,no-await-in-loop
        (await lstat(dir)).isDirectory();

        // eslint-disable-next-line no-await-in-loop
        const realDirectory = await realpath(dir);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,no-await-in-loop,@typescript-eslint/no-unsafe-call
        const files: string[] = await collect(realDirectory, {
            extensions: openapiConfig.extensions ?? [".js", ".cjs", ".mjs", ".ts", ".tsx", ".jsx", ".yaml", ".yml"],
            followSymlinks: openapiConfig.followSymlinks ?? false,
            match: openapiConfig.include,
            skip: [...skip],
        } as WalkOptions);

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
        // eslint-disable-next-line no-console,unicorn/no-null
        console.log(JSON.stringify(spec, null, 2));
    }

    await validate(structuredClone(spec) as Record<string, unknown>);

    const output = options.output ?? "swagger.json";

    multibar.stop();

    if (options.verbose) {
        // eslint-disable-next-line no-console
        console.log(`Written swagger spec to "${output}" file`);
    }

    await mkdir(dirname(output), { recursive: true });
    // eslint-disable-next-line unicorn/no-null
    await writeFile(output, JSON.stringify(spec, null, 2));

    // eslint-disable-next-line no-console
    console.log(`\nSwagger specification is ready, check the "${output}" file.`);
};

export default generateCommand;
