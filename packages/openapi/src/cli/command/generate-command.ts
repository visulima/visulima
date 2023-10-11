import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, normalize } from "node:path";
import { pathToFileURL } from "node:url";

import collectFiles from "../../generator/util/collect-files";
import generateCode from "../../generator/util/generate-code";
import resolveOptions from "../../generator/util/resolve-options";

const generateCommand = async (
    configName: string,
    paths: string[],
    options: {
        config?: string;
        "follow-symlinks"?: boolean;
        output?: string;
        verbose?: boolean;
    },
): Promise<void> => {
    try {
        let config = await import(pathToFileURL(normalize(options.config ?? configName)).href);

        if (config?.default) {
            config = config.default;
        }

        config.include = [...config.include, ...paths];
        config.outputFilePath = options.output ?? config.outputFilePath;
        config.verbose = options.verbose ?? config.verbose;

        const { exclude, extensions, include, outputFilePath, stopOnInvalid, swaggerDefinition, verbose } = resolveOptions(config);

        const files = await collectFiles(include, [...exclude, outputFilePath], extensions, verbose, options["follow-symlinks"] ?? false);

        const fileContent = await generateCode(files, swaggerDefinition, verbose, stopOnInvalid);

        if (options.verbose) {
            // eslint-disable-next-line no-console
            console.log(`Written swagger spec to "${outputFilePath}" file`);
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        mkdirSync(dirname(outputFilePath), { recursive: true });
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        writeFileSync(outputFilePath, JSON.stringify(fileContent, null, 2));

        // eslint-disable-next-line no-console
        console.log(`\nSwagger specification is ready, check the "${outputFilePath}" file.`);
    } catch {
        throw new Error(`No config file found, on: ${options.config ?? ".openapirc.js"}\n`);
    }
};

export default generateCommand;
