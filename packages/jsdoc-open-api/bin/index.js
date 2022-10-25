#!/usr/bin/env node
const path = require("node:path");
const fs = require("node:fs");
const { Command } = require("commander");
const SwaggerParser = require("@apidevtools/swagger-parser");
const { collect } = require("@visulima/readdir");
const cliProgress = require("cli-progress");

const { jsDocumentCommentsToOpenApi, parseFile, SpecBuilder, swaggerJsDocumentCommentsToOpenApi } = require("../dist/index.js");

const package_ = require("../package.json");

const program = new Command();

program.name("@visulima/jsdoc-open-api").description("CLI to to generate OpenAPI (Swagger) documentation from JSDoc's").version(package_.version);

program
    .command("init")
    .description("Inits a pre-configured @visulima/jsdoc-open-api config file.")
    .action(() => {
        if (fs.existsSync(".openapirc.js")) {
            console.error("Config file already exists");
            process.exit(1);
        }

        fs.writeFileSync(
            ".openapirc.js",
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
    '**/package-lock.json',
    '**/yarn.lock',
    '**/package.json',
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
    .action(async (paths, options) => {
        let openapiConfig = {};

        try {
            openapiConfig = require(path.resolve(options.config || ".openapirc.js"));
        } catch (error) {
            console.log("No config file found, on: ", options.config || ".openapirc.js\n");
            console.error(error);
            process.exit(1);
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
            const files = await collect(dir, {
                // eslint-disable-next-line @rushstack/security/no-unsafe-regexp
                skip: [...openapiConfig.exclude, "node_modules/**"],
                extensions: openapiConfig.extension || [".js", ".cjs", ".mjs", ".ts", ".tsx", ".jsx", ".yaml", ".yml"],
                followSymlinks: openapiConfig.followSymlinks || false,
                match: openapiConfig.include,
                minimatchOptions: {
                    debug: options.verbose,
                    matchBase: true,
                },
            });

            if (options.verbose || options.veryVerbose) {
                // eslint-disable-next-line no-console
                console.log("\n" + `Found ${files.length} files in ${dir}`);
            }

            if (options.veryVerbose) {
                // eslint-disable-next-line no-console
                console.log(files);
            }

            const bar = multibar.create(files.length, 0);

            files.forEach((file) => {
                if (options.verbose) {
                    console.log(`Parsing file ${file}`);
                }

                bar.increment(1, { filename: dir });

                const parsedJsDocumentFile = parseFile(file, jsDocumentCommentsToOpenApi, this.verbose);

                spec.addData(parsedJsDocumentFile.map((item) => item.spec));

                const parsedSwaggerJsDocumentFile = parseFile(file, swaggerJsDocumentCommentsToOpenApi, this.verbose);

                spec.addData(parsedSwaggerJsDocumentFile.map((item) => item.spec));
            });
        }

        try {
            await SwaggerParser.validate(JSON.parse(JSON.stringify(spec)));
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error(error.toJSON());
            process.exit();
        }

        const output = options.output || "swagger.json";

        multibar.stop();

        fs.writeFileSync(output, JSON.stringify(spec, null, 2));

        console.log(`\nSwagger specification is ready, check the${output}file.`);
    });

program.parse(process.argv);

if (process.argv.slice(2).length === 0) {
    program.help();
    process.exit();
}
