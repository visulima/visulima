const { nodeResolve } = require("@rollup/plugin-node-resolve");
const commonjs = require("@rollup/plugin-commonjs");
const json = require("@rollup/plugin-json");
const typescript = require("@rollup/plugin-typescript");
const terser = require("@rollup/plugin-terser");
const jsdocOpenApi = require("@visulima/openapi/rollup");

const packageJson = require("./package.json");

const config = {
    input: `src/express.ts`,
    plugins: [
        nodeResolve({
            preferBuiltins: true,
        }),
        commonjs(),
        typescript({
            tsconfig: "./tsconfig.json",
            declaration: true,
            declarationDir: "dist",
        }),
        terser(),
        json(),
        jsdocOpenApi({
            include: ["src"],
            outputFilePath: "swagger/swagger.json",
            swaggerDefinition: {
                openapi: "3.0.0",
                info: {
                    description: packageJson.description,
                    title: packageJson.name,
                    version: packageJson.version,
                },
            },
        }),
    ],
    output: [
        {
            file: `dist/express.js`,
            format: "cjs",
            sourcemap: true,
        },
    ],
};

module.exports = config;
