#!/usr/bin/env node
// eslint-disable-next-line unicorn/prefer-module
const path = require("node:path");
// eslint-disable-next-line unicorn/prefer-module
const fs = require("node:fs");
// eslint-disable-next-line unicorn/prefer-module
const { exit } = require("node:process");
// eslint-disable-next-line unicorn/prefer-module
const { Command } = require("commander");
// eslint-disable-next-line unicorn/prefer-module
const SwaggerParser = require("@apidevtools/swagger-parser");
// eslint-disable-next-line unicorn/prefer-module
const { collect } = require("@visulima/readdir");
// eslint-disable-next-line unicorn/prefer-module
const cliProgress = require("cli-progress");

const {
    jsDocumentCommentsToOpenApi,
    parseFile,
    SpecBuilder,
    swaggerJsDocumentCommentsToOpenApi,
    // eslint-disable-next-line unicorn/prefer-module
} = require("../dist/index.js");

// eslint-disable-next-line unicorn/prefer-module,no-underscore-dangle
const package_ = require("../package.json");

const program = new Command();
const defaultConfigName = ".openapirc.js";

program.name("@visulima/jsdoc-open-api").description("CLI to to generate OpenAPI (Swagger) documentation from JSDoc's").version(package_.version);

program
    .command("init")
    .description("Inits a pre-configured @visulima/jsdoc-open-api config file.")
    .action(() => {
        if (fs.existsSync(defaultConfigName)) {
            // eslint-disable-next-line no-console
            console.error("Config file already exists");
            exit(1);
        }

        fs.writeFileSync(
            defaultConfigName,
            `module.exports = {
  exclude: [
    'coverage/**',
    '.github/**',
    'packages/*/test{,s}/**',
    '**/*.d.ts',
    'test{,s}/**',
    'test{,-*}.{js,cjs,mjs,ts,tsx,jsx,yaml,yml}',
    '**/*{.,-}test.{js,cjs,mjs,ts,tsx,jsx,yaml,yml}',
    '**/__tests__/**',
    '**/{ava,babel,nyc}.config.{js,cjs,mjs}',
    '**/jest.config.{js,cjs,mjs,ts}',
    '**/{karma,rollup,webpack}.config.js',
    '**/.{eslint,mocha}rc.{js,cjs}',
    '**/.{travis,yarnrc}.yml',
    '**/{docker-compose,docker}.yml',
    '**/.yamllint.{yaml,yml}',
    '**/node_modules/**',
    '**/pnpm-lock.yaml',
    '**/pnpm-workspace.yaml',
    '**/{package,package-lock}.json',
    '**/yarn.lock',
    '**/package.json5',
    '**/.next/**',
  ],
  followSymlinks: false,
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'API',
      version: '1.0.0',
    },
  },
};
`,
        );

        // eslint-disable-next-line no-console
        console.log("Created .openapirc.js");
    });

program
    .command("generate")
    .description("Generates OpenAPI (Swagger) documentation from JSDoc's")
    .usage("[options] <path ...>")
    .argument("[path ...]", "Paths to files or directories to parse")
    .option("-c, --config [.openapirc.js]", "@visulima/jsdoc-open-api config file path.")
    .option("-o, --output [swaggerSpec.json]", "Output swagger specification.")
    .option("-v, --verbose", "Verbose output.")
    .option("-vv, --very-verbose", "Very verbose output.")
    // eslint-disable-next-line radar/cognitive-complexity
    .action(async (paths, options) => {
        let openapiConfig = {};

        try {
            // eslint-disable-next-line unicorn/prefer-module,import/no-dynamic-require
            openapiConfig = require(path.resolve(options.config || defaultConfigName));
        } catch (error) {
            // eslint-disable-next-line no-console
            console.log("No config file found, on:", options.config || ".openapirc.js\n");
            // eslint-disable-next-line no-console
            console.error(error);
            exit(1);
        }

        const multibar = new cliProgress.MultiBar(
            {
                clearOnComplete: false,
                hideCursor: true,
                format: "{value}/{total} | {bar} | {filename}",
            },
            cliProgress.Presets.shades_grey,
        );
        const spec = new SpecBuilder(openapiConfig.swaggerDefinition);

        // eslint-disable-next-line no-restricted-syntax,unicorn/prevent-abbreviations
        for await (const dir of paths) {
            // Check if the path is a directory
            fs.lstatSync(dir).isDirectory();

            const files = await collect(dir, {
                // eslint-disable-next-line @rushstack/security/no-unsafe-regexp
                skip: [...openapiConfig.exclude, "node_modules/**"],
                extensions: openapiConfig.extension || [".js", ".cjs", ".mjs", ".ts", ".tsx", ".jsx", ".yaml", ".yml"],
                followSymlinks: openapiConfig.followSymlinks || false,
                match: openapiConfig.include,
                minimatchOptions: {
                    match: {
                        debug: options.verbose,
                        matchBase: true,
                    },
                    skip: {
                        debug: options.verbose,
                        matchBase: true,
                    },
                },
            });

            if (options.verbose || options.veryVerbose) {
                // eslint-disable-next-line no-console
                console.log(`\nFound ${files.length} files in ${dir}`);
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

                bar.increment(1, { filename: dir });

                try {
                    const parsedJsDocumentFile = parseFile(file, jsDocumentCommentsToOpenApi, this.verbose);

                    spec.addData(parsedJsDocumentFile.map((item) => item.spec));

                    const parsedSwaggerJsDocumentFile = parseFile(file, swaggerJsDocumentCommentsToOpenApi, this.verbose);

                    spec.addData(parsedSwaggerJsDocumentFile.map((item) => item.spec));
                } catch (error) {
                    // eslint-disable-next-line no-console
                    console.error(error);
                    exit(1);
                }
            });
        }

        try {
            if (options.verbose) {
                // eslint-disable-next-line no-console
                console.log("Validating swagger spec");
            }

            if (options.veryVerbose) {
                // eslint-disable-next-line no-console
                console.log(JSON.stringify(spec, null, 2));
            }

            await SwaggerParser.validate(JSON.parse(JSON.stringify(spec)));
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error(error.toJSON());
            exit(1);
        }

        const output = options.output || "swagger.json";

        multibar.stop();

        if (options.verbose) {
            // eslint-disable-next-line no-console
            console.log(`Written swagger spec to "${output}" file`);
        }

        const errorHandler = (error) => {
            if (error) {
                // eslint-disable-next-line no-console
                console.error(error);
                exit(1);
            }
        };

        // eslint-disable-next-line consistent-return
        fs.mkdir(path.dirname(output), { recursive: true }, (error) => {
            if (error) {
                errorHandler(error);
            }

            fs.writeFile(output, JSON.stringify(spec, null, 2), errorHandler);
        });

        // eslint-disable-next-line no-console
        console.log(`\nSwagger specification is ready, check the${output}file.`);
    });
// eslint-disable-next-line no-undef
program.parse(process.argv);

// eslint-disable-next-line no-undef
if (process.argv.slice(2).length === 0) {
    program.help();
    exit(1);
}
