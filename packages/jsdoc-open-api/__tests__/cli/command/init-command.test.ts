// eslint-disable-next-line import/no-namespace
import * as fs from "node:fs";
import {
    describe, expect, it, vi,
} from "vitest";

import initCommand from "../../../src/cli/command/init-command";

vi.mock("node:fs", () => {
    return {
        existsSync: vi.fn(),
        writeFileSync: vi.fn(),
    };
});

describe("init command", () => {
    it("throws an error when the config file already exists", () => {
        vi.spyOn(fs, "existsSync").mockReturnValue(true);
        vi.spyOn(console, "log");

        // Expect the function to throw an error
        expect(() => initCommand("config.js")).toThrowError("Config file already exists");
    });

    it("creates a new config file with the correct contents", () => {
    // Create a mock for the existsSync function to return false
        vi.spyOn(fs, "existsSync").mockReturnValue(false);
        vi.spyOn(console, "log");

        const writeFileSyncMock = vi.spyOn(fs, "writeFileSync");

        initCommand("config.js");

        // Verify that the writeFileSync function was called with the correct arguments
        expect(writeFileSyncMock).toHaveBeenCalledWith(
            "config.js",
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
    });

    it("logs a message when the config file is created", () => {
        vi.spyOn(fs, "existsSync").mockReturnValue(false);

        const consoleLogMock = vi.spyOn(console, "log");

        initCommand("config.js");

        expect(consoleLogMock).toHaveBeenCalledWith("Created \"config.js\"");
    });
});
