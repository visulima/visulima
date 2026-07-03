import { lstat, mkdir, realpath, writeFile } from "node:fs/promises";
import { dirname, extname, normalize } from "node:path";
import { stdout } from "node:process";
import { pathToFileURL } from "node:url";

import { collect } from "@visulima/fs";
// eslint-disable-next-line import/no-extraneous-dependencies
import { MultiBar, Presets } from "cli-progress";
import yaml from "yaml";

import { DEFAULT_EXCLUDE } from "../../constants";
import type { BaseDefinition } from "../../exported";
import jsDocumentCommentsToOpenApi from "../../jsdoc/comments-to-open-api";
import { parseFileMulti } from "../../parse-file";
import SpecBuilder from "../../spec-builder";
import swaggerJsDocumentCommentsToOpenApi from "../../swagger-jsdoc/comments-to-open-api";
import loadDefinition from "../../util/load-definition";
import validate from "../../validate";

const YAML_OUTPUT_EXTENSIONS = new Set([".yaml", ".yml"]);

const STDOUT_OUTPUT = "-";

const translators = [jsDocumentCommentsToOpenApi, swaggerJsDocumentCommentsToOpenApi];

type OpenApiConfig = {
    definition?: string;
    exclude: string[];
    extensions?: string[];
    followSymlinks?: boolean;
    include?: (RegExp | string)[];
    swaggerDefinition: BaseDefinition;
};

const loadConfig = async (configPath: string): Promise<OpenApiConfig> => {
    try {
        let config = await import(pathToFileURL(normalize(configPath)).href);

        if (config?.default) {
            config = config.default;
        }

        return config as OpenApiConfig;
    } catch (error: any) {
        // Distinguish a genuinely missing file from a config that exists but
        // throws while being evaluated (syntax error, bad export, throwing
        // top-level code). Reporting the latter as "No config file found" hides
        // the real cause.
        if (error?.code === "ERR_MODULE_NOT_FOUND" || error?.code === "MODULE_NOT_FOUND" || error?.code === "ERR_LOAD_URL") {
            throw new Error(`No config file found, on: ${configPath}\n`, { cause: error });
        }

        const message = error instanceof Error ? error.message : String(error);

        throw new Error(`Failed to load config file "${configPath}": ${message}`, { cause: error });
    }
};

const buildSpec = async (
    configName: string,
    paths: string[],
    options: {
        config?: string;
        definition?: string;
        output?: string;
        verbose?: boolean;
        veryVerbose?: boolean;
    },
): Promise<SpecBuilder> => {
    const openapiConfig = await loadConfig(options.config ?? configName);

    // A standalone base-definition file (`-d definition.yaml`) seeds info/servers/
    // components; CLI flag wins over the config's `definition` field.
    const definitionPath = options.definition ?? openapiConfig.definition;

    let { swaggerDefinition } = openapiConfig;

    if (definitionPath) {
        swaggerDefinition = { ...loadDefinition(definitionPath), ...swaggerDefinition };
    }

    const writeToStdout = options.output === STDOUT_OUTPUT;

    // The progress bar writes to stdout — suppress it when piping the spec there.
    const multibar = writeToStdout
        ? undefined
        : new MultiBar(
            {
                clearOnComplete: false,
                format: "{value}/{total} | {bar} | {filename}",
                hideCursor: true,
            },
            Presets.shades_grey,
        );

    const spec = new SpecBuilder(swaggerDefinition);
    const skip = new Set<RegExp | string>([...DEFAULT_EXCLUDE, ...openapiConfig.exclude]);

    // eslint-disable-next-line unicorn/prevent-abbreviations
    for (const dir of paths) {
        // Check if the path is a directory
        // eslint-disable-next-line unicorn/no-await-expression-member,no-await-in-loop
        const isDirectory = (await lstat(dir)).isDirectory();

        // eslint-disable-next-line no-await-in-loop
        const realDirectory = await realpath(dir);

        if (!isDirectory) {
            spec.addData(parseFileMulti(realDirectory, translators, options.verbose).map((item) => item.spec));

            continue;
        }

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

        const bar = multibar?.create(files.length, 0);

        files.forEach((file) => {
            if (options.verbose) {
                // eslint-disable-next-line no-console
                console.log(`Parsing file ${file}`);
            }

            bar?.increment(1, { filename: realDirectory });

            spec.addData(parseFileMulti(file, translators, options.verbose).map((item) => item.spec));
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

    multibar?.stop();

    return spec;
};

const serializeSpec = (spec: SpecBuilder, output: string): string => {
    if (YAML_OUTPUT_EXTENSIONS.has(extname(output))) {
        // structuredClone strips the SpecBuilder class wrapper to a plain object.
        return yaml.stringify(structuredClone(spec));
    }

    return JSON.stringify(spec, undefined, 2);
};

const generateCommand = async (
    configName: string,
    paths: string[],
    options: {
        config?: string;
        definition?: string;
        output?: string;
        verbose?: boolean;
        veryVerbose?: boolean;
    },
): Promise<void> => {
    const spec = await buildSpec(configName, paths, options);

    const output = options.output ?? "swagger.json";

    if (output === STDOUT_OUTPUT) {
        stdout.write(`${serializeSpec(spec, "swagger.json")}\n`);

        return;
    }

    if (options.verbose) {
        // eslint-disable-next-line no-console
        console.log(`Written swagger spec to "${output}" file`);
    }

    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, serializeSpec(spec, output));

    // eslint-disable-next-line no-console
    console.log(`\nSwagger specification is ready, check the "${output}" file.`);
};

export default generateCommand;
