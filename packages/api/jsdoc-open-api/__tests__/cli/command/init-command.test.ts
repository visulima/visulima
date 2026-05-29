// eslint-disable-next-line import/no-namespace
import * as fs from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import initCommand from "../../../src/cli/command/init-command";

vi.mock(import("node:fs"), () => {
    return {
        existsSync: vi.fn(),
        realpathSync: vi.fn(),
        writeFileSync: vi.fn(),
    };
});

vi.mock(import("@visulima/fs"), () => {
    return {
        findUpSync: vi.fn(),
        readJsonSync: vi.fn(),
    };
});

const isWin = process.platform === "win32";

describe("init command", () => {
    it("should throw an error when the config file already exists", () => {
        expect.assertions(1);

        vi.spyOn(fs, "existsSync").mockReturnValue(true);
        vi.spyOn(console, "log");

        // Expect the function to throw an error
        expect(() => { initCommand("config.js"); }).toThrow("Config file already exists");
    });

    it("should create a new config file with the correct module.exports content", async () => {
        expect.assertions(1);

        const { findUpSync } = await import("@visulima/fs");

        // Create a mock for the existsSync function to return false
        vi.spyOn(fs, "existsSync").mockReturnValue(false);
        vi.spyOn(console, "log");
        vi.mocked(findUpSync).mockReturnValue(undefined);

        const writeFileSyncMock = vi.spyOn(fs, "writeFileSync");

        initCommand("config.js");

        // Verify that the writeFileSync function was called with the correct arguments
        expect(writeFileSyncMock).toHaveBeenCalledExactlyOnceWith(
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

    it("should create a new config file with the correct export default content", async () => {
        expect.assertions(3);

        const { findUpSync, readJsonSync } = await import("@visulima/fs");

        const fixturePath = join(__dirname, "../../../", "__fixtures__");
        const packageJsonPath = `${fixturePath}${isWin ? "\\" : "/"}package.json`;

        // Create a mock for the existsSync function to return false
        vi.spyOn(fs, "existsSync").mockReturnValue(false);
        vi.spyOn(console, "log");

        vi.spyOn(fs, "realpathSync").mockReturnValue(fixturePath);
        vi.mocked(findUpSync).mockReturnValue(packageJsonPath);
        vi.mocked(readJsonSync).mockReturnValue({ type: "module" });

        const consoleInfoMock = vi.spyOn(console, "info");
        const writeFileSyncMock = vi.spyOn(fs, "writeFileSync");

        initCommand("config.js");

        expect(consoleInfoMock).toHaveBeenNthCalledWith(1, `Found package.json at "${packageJsonPath}"`);
        expect(consoleInfoMock).toHaveBeenNthCalledWith(2, "Found package.json with type: module, using ES6 as export for the config file");
        // Verify that the writeFileSync function was called with the correct arguments
        expect(writeFileSyncMock).toHaveBeenCalledWith(
            "config.js",
            `export default {
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

    it("should log a message when the config file is created", () => {
        expect.assertions(1);

        vi.spyOn(fs, "existsSync").mockReturnValue(false);

        const consoleLogMock = vi.spyOn(console, "log");

        initCommand("config.js");

        expect(consoleLogMock).toHaveBeenCalledWith("Created \"config.js\"");
    });

    it("uses module.exports when package.json has no module type", async () => {
        expect.assertions(2);

        const { findUpSync, readJsonSync } = await import("@visulima/fs");

        const fixturePath = join(__dirname, "../../../", "__fixtures__");
        const packageJsonPath = `${fixturePath}${isWin ? "\\" : "/"}package.json`;

        vi.spyOn(fs, "existsSync").mockReturnValue(false);
        vi.spyOn(console, "log");
        vi.spyOn(fs, "realpathSync").mockReturnValue(fixturePath);
        vi.mocked(findUpSync).mockReturnValue(packageJsonPath);
        // No `type` field — exercises the falsy branch of `packageJson.type === "module"`.
        vi.mocked(readJsonSync).mockReturnValue({});

        const consoleInfoMock = vi.spyOn(console, "info").mockClear();
        const writeFileSyncMock = vi.spyOn(fs, "writeFileSync").mockClear();

        initCommand("config.js");

        expect(consoleInfoMock).toHaveBeenCalledExactlyOnceWith(`Found package.json at "${packageJsonPath}"`);
        expect(writeFileSyncMock).toHaveBeenCalledWith("config.js", expect.stringContaining("module.exports ="));
    });
});
