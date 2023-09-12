const { build } = require("esbuild");
const jsdocOpenApi = require("@visulima/openapi/esbuild");

const packageJson = require("./package.json");

build({
    outdir: "dist",
    entryPoints: ["src/express.ts"],
    bundle: true,
    platform: "node",
    packages: "external",
    plugins: [
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
});
