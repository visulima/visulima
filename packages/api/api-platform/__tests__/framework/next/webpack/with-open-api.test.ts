import fs, { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { WebpackConfigContext } from "next/dist/server/config-shared";
import type { NextConfig } from "next/types";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { Configuration } from "webpack";

import withOpenApi from "../../../../src/framework/next/webpack/with-open-api";

const baseDefinition = {
    info: { title: "Test", version: "1.0.0" },
};

let projectDirectory: string;
let serverContext: WebpackConfigContext;

const runWebpack = (nextConfig: NextConfig, config: Configuration, context: WebpackConfigContext): Configuration => {
    const webpack = nextConfig.webpack as (config: Configuration, context: WebpackConfigContext) => Configuration;

    return webpack(config, context);
};

describe("framework/next/webpack/with-open-api", () => {
    beforeAll(() => {
        projectDirectory = mkdtempSync(join(tmpdir(), "with-open-api-"));

        mkdirSync(join(projectDirectory, "src"));
        mkdirSync(join(projectDirectory, "lib"));

        serverContext = { dir: projectDirectory, isServer: true } as unknown as WebpackConfigContext;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    afterAll(() => {
        rmSync(projectDirectory, { force: true, recursive: true });
    });

    it("should return the config unchanged when not building for the server", () => {
        expect.assertions(1);

        const config = { plugins: [] } as unknown as Configuration;

        const nextConfig = withOpenApi({
            definition: baseDefinition,
            output: "/swagger/swagger.json",
            sources: ["./src"],
        })({});

        const result = runWebpack(nextConfig, config, { dir: projectDirectory, isServer: false } as unknown as WebpackConfigContext);

        expect(result).toBe(config);
    });

    it("should register the SwaggerCompilerPlugin for the server build", () => {
        expect.assertions(2);

        const lstatSyncSpy = vi.spyOn(fs, "lstatSync");

        const config = { plugins: [] } as unknown as Configuration;

        const nextConfig = withOpenApi({
            definition: baseDefinition,
            output: "/swagger/swagger.json",
            sources: ["./src", "lib"],
            verbose: true,
        })({});

        const result = runWebpack(nextConfig, config, serverContext);

        expect(result.plugins ?? []).toHaveLength(1);
        expect(lstatSyncSpy).toHaveBeenCalledTimes(2);
    });

    it("should throw when the output path does not end with .json", () => {
        expect.assertions(1);

        const config = { plugins: [] } as unknown as Configuration;

        const nextConfig = withOpenApi({
            definition: baseDefinition,
            output: "swagger/swagger.yaml",
            sources: ["./src"],
        })({});

        expect(() => runWebpack(nextConfig, config, serverContext)).toThrow("The output path must end with .json");
    });

    it("should chain a pre-existing nextConfig.webpack function", () => {
        expect.assertions(1);

        const config = { plugins: [] } as unknown as Configuration;
        const innerWebpack = vi.fn<(received: Configuration) => Configuration>((received) => received);

        const nextConfig = { webpack: innerWebpack } as unknown as NextConfig;

        const wrapped = withOpenApi({
            definition: baseDefinition,
            output: "swagger/swagger.json",
            sources: ["./src"],
        })(nextConfig);

        runWebpack(wrapped, config, serverContext);

        expect(innerWebpack).toHaveBeenCalledTimes(1);
    });
});
