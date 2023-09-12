const path = require("path");
const nodeExternals = require("webpack-node-externals");
const jsdocOpenApi = require("@visulima/openapi/webpack");

const packageJson = require("./package.json");

module.exports = {
    entry: "./src/express.ts",
    watch: true,
    module: {
        rules: [
            {
                test: /\.ts?$/,
                use: "ts-loader",
                exclude: /node_modules/,
            },
        ],
    },
    externals: [nodeExternals()],
    resolve: {
        extensions: [".tsx", ".ts", ".js"],
    },
    output: {
        filename: "express.js",
        path: path.resolve(__dirname, "dist"),
    },
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
        // hack for https://stackoverflow.com/questions/56053159/webpack-run-build-but-not-exit-command
        {
            apply: (compiler) => {
                compiler.hooks.done.tap("DonePlugin", (stats) => {
                    setTimeout(() => {
                        process.exit(0);
                    });
                });
            },
        },
    ],
};
