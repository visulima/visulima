import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
// eslint-disable-next-line import/no-namespace
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import generateCommand from "../../../src/cli/command/generate-command";

vi.mock(import("node:fs/promises"), async () => {
    return {
        ...await import("node:fs/promises"),
        writeFile: vi.fn(),
    };
});

const fixturesDirectory = `${__dirname}/../../../__fixtures__`;

describe("generate command", () => {
    beforeEach(() => {
        // Reset the shared module-level writeFile mock so each test's call history is isolated
        // (the snapshot assertion depends on a single recorded call).
        vi.clearAllMocks();
    });

    it("throws an error when no config file is found", async () => {
        expect.assertions(1);

        const paths = ["/path/to/dir"];

        const options = { config: "/path/to/nonexistent/config.js" };

        await expect(generateCommand(".openapirc.js", paths, options)).rejects.toThrow("No config file found, on: /path/to/nonexistent/config.js");
    });

    it("falls back to the default \".openapirc.js\" name in the error when no config option is given", async () => {
        expect.assertions(1);

        // No `config` option, and the resolved config name does not exist on disk.
        await expect(generateCommand("/path/to/missing/.openapirc.js", ["/path/to/dir"], {})).rejects.toThrow(
            "No config file found, on: .openapirc.js",
        );
    });

    it("resolves the config from the positional config name when no config option is provided", async () => {
        expect.assertions(1);

        const consoleLogMock = vi.spyOn(console, "log").mockImplementation(() => undefined);

        // Pass the fixture path as the positional `configName` (options.config is undefined).
        await generateCommand(join(fixturesDirectory, ".openapirc.js"), [fixturesDirectory], {});

        expect(consoleLogMock).toHaveBeenCalledWith("\nSwagger specification is ready, check the \"swagger.json\" file.");

        consoleLogMock.mockRestore();
    });

    it("collects the correct files from the given directories", async () => {
        expect.assertions(2);

        const writeFileSpy = vi.spyOn(fs, "writeFile");
        const consoleLogMock = vi.spyOn(console, "log");

        await generateCommand(".openapirc.js", [fixturesDirectory], { config: join(fixturesDirectory, ".openapirc.js") });

        expect(writeFileSpy).toMatchSnapshot();
        expect(consoleLogMock).toHaveBeenCalledExactlyOnceWith("\nSwagger specification is ready, check the \"swagger.json\" file.");
    });

    it("defaults followSymlinks when the config omits it", async () => {
        expect.assertions(1);

        const workDirectory = mkdtempSync(join(tmpdir(), "generate-config-"));
        const configPath = join(workDirectory, "config.cjs");

        // Config without `followSymlinks` / `extensions` / `include` so the `?? false` and
        // related defaults are exercised.
        writeFileSync(
            configPath,
            "module.exports = { exclude: [], swaggerDefinition: { openapi: \"3.0.0\", info: { title: \"API\", version: \"1.0.0\" } } };\n",
        );

        const consoleLogMock = vi.spyOn(console, "log").mockImplementation(() => undefined);

        try {
            await generateCommand(".openapirc.js", [join(fixturesDirectory, "routes")], { config: configPath });

            expect(consoleLogMock).toHaveBeenCalledWith("\nSwagger specification is ready, check the \"swagger.json\" file.");
        } finally {
            consoleLogMock.mockRestore();
            rmSync(workDirectory, { force: true, recursive: true });
        }
    });

    it("logs the extra diagnostics when verbose and veryVerbose are enabled", async () => {
        expect.assertions(5);

        const consoleLogMock = vi.spyOn(console, "log").mockImplementation(() => undefined);

        await generateCommand(".openapirc.js", [fixturesDirectory], {
            config: join(fixturesDirectory, ".openapirc.js"),
            verbose: true,
            veryVerbose: true,
        });

        const messages = consoleLogMock.mock.calls.map((call) => call[0]);

        expect(messages.some((message) => typeof message === "string" && message.includes("Found "))).toBe(true);
        expect(messages.some((message) => typeof message === "string" && message.includes("Parsing file "))).toBe(true);
        expect(messages).toContain("Validating swagger spec");
        expect(messages.some((message) => typeof message === "string" && message.includes("Written swagger spec to"))).toBe(true);
        expect(messages).toContain("\nSwagger specification is ready, check the \"swagger.json\" file.");

        consoleLogMock.mockRestore();
    });
});
