import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import jsdocOpenApi from "@visulima/openapi/rollup";

import packageJson from "./package.json" assert { type: "json" };

export default {
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
