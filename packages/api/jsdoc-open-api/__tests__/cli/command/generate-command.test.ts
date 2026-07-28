import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
// eslint-disable-next-line import/no-namespace
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

import { beforeEach, describe, expect, it, vi } from "vitest";
import yaml from "yaml";

import generateCommand from "../../../src/cli/command/generate-command";

const { multiBarStopMock } = vi.hoisted(() => {
    return {
        multiBarStopMock: vi.fn(),
    };
});

vi.mock(import("node:fs/promises"), async () => {
    return {
        ...await import("node:fs/promises"),
        writeFile: vi.fn(),
    };
});

vi.mock(import("cli-progress"), () => {
    class MultiBar {
        // eslint-disable-next-line class-methods-use-this
        public create(): { increment: () => void } {
            return { increment: () => undefined };
        }

        // eslint-disable-next-line class-methods-use-this
        public stop(): void {
            multiBarStopMock();
        }
    }

    return {
        MultiBar,
        Presets: { shades_grey: {} },
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

    it("reports the resolved config name in the error when no config option is given", async () => {
        expect.assertions(1);

        // No `config` option, so it falls back to the positional config name. The
        // error now reports the path it actually tried to load (previously it always
        // printed the literal ".openapirc.js", masking the real path).
        await expect(generateCommand("/path/to/missing/.openapirc.js", ["/path/to/dir"], {})).rejects.toThrow(
            "No config file found, on: /path/to/missing/.openapirc.js",
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

    it("surfaces the real error when the config file exists but fails to evaluate", async () => {
        expect.assertions(1);

        const workDirectory = mkdtempSync(join(tmpdir(), "generate-bad-config-"));
        const configPath = join(workDirectory, "broken.cjs");

        // Valid module path, but the module throws while being evaluated.
        writeFileSync(configPath, "throw new Error(\"kaboom from config\");\n");

        try {
            await expect(generateCommand(".openapirc.js", [fixturesDirectory], { config: configPath })).rejects.toThrow("kaboom from config");
        } finally {
            rmSync(workDirectory, { force: true, recursive: true });
        }
    });

    it("writes YAML output when the output path ends with .yaml", async () => {
        expect.assertions(2);

        const writeFileSpy = vi.spyOn(fs, "writeFile");
        const consoleLogMock = vi.spyOn(console, "log").mockImplementation(() => undefined);

        try {
            await generateCommand(".openapirc.js", [fixturesDirectory], {
                config: join(fixturesDirectory, ".openapirc.js"),
                output: "openapi.yaml",
            });

            const [path, contents] = writeFileSpy.mock.calls.at(-1) as [string, string];

            expect(path).toBe("openapi.yaml");
            // The serialized payload must be parseable YAML carrying the openapi field.
            expect((yaml.parse(contents) as { openapi?: string }).openapi).toBeDefined();
        } finally {
            consoleLogMock.mockRestore();
        }
    });

    it("writes to stdout and skips the file write when output is \"-\"", async () => {
        expect.assertions(2);

        const writeFileSpy = vi.spyOn(fs, "writeFile");
        const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

        try {
            await generateCommand(".openapirc.js", [fixturesDirectory], {
                config: join(fixturesDirectory, ".openapirc.js"),
                output: "-",
            });

            expect(stdoutSpy).toHaveBeenCalledTimes(1);
            expect(writeFileSpy).not.toHaveBeenCalled();
        } finally {
            stdoutSpy.mockRestore();
        }
    });

    it("defaults exclude when the config omits it", async () => {
        expect.assertions(1);

        const workDirectory = mkdtempSync(join(tmpdir(), "generate-no-exclude-"));
        const configPath = join(workDirectory, "config.cjs");

        // Config without `exclude` — previously threw "openapiConfig.exclude is not iterable".
        writeFileSync(
            configPath,
            "module.exports = { swaggerDefinition: { openapi: \"3.0.0\", info: { title: \"API\", version: \"1.0.0\" } } };\n",
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

    it("throws a descriptive error naming the config when swaggerDefinition is missing", async () => {
        expect.assertions(1);

        const workDirectory = mkdtempSync(join(tmpdir(), "generate-no-definition-"));
        const configPath = join(workDirectory, "config.cjs");

        // Config with no swaggerDefinition and no -d definition file.
        writeFileSync(configPath, "module.exports = { exclude: [] };\n");

        try {
            await expect(generateCommand(".openapirc.js", [join(fixturesDirectory, "routes")], { config: configPath })).rejects.toThrow(
                `missing "swaggerDefinition" object`,
            );
        } finally {
            rmSync(workDirectory, { force: true, recursive: true });
        }
    });

    it("throws a descriptive error when swaggerDefinition is null in the config", async () => {
        expect.assertions(1);

        const workDirectory = mkdtempSync(join(tmpdir(), "generate-null-definition-"));
        const configPath = join(workDirectory, "config.cjs");

        // `typeof null === "object"` would otherwise slip a null swaggerDefinition
        // through into `new SpecBuilder(null)`; the null guard must reject it first.
        writeFileSync(configPath, "module.exports = { exclude: [], swaggerDefinition: null };\n");

        try {
            await expect(generateCommand(".openapirc.js", [join(fixturesDirectory, "routes")], { config: configPath })).rejects.toThrow(
                `missing "swaggerDefinition" object`,
            );
        } finally {
            rmSync(workDirectory, { force: true, recursive: true });
        }
    });

    it("scans a symlinked directory instead of failing with EISDIR", async () => {
        expect.assertions(1);

        const workDirectory = mkdtempSync(join(tmpdir(), "generate-symlink-"));
        const linkPath = join(workDirectory, "routes-link");

        symlinkSync(join(fixturesDirectory, "routes"), linkPath, "dir");

        const consoleLogMock = vi.spyOn(console, "log").mockImplementation(() => undefined);

        try {
            await generateCommand(".openapirc.js", [linkPath], { config: join(fixturesDirectory, ".openapirc.js") });

            expect(consoleLogMock).toHaveBeenCalledWith("\nSwagger specification is ready, check the \"swagger.json\" file.");
        } finally {
            consoleLogMock.mockRestore();
            rmSync(workDirectory, { force: true, recursive: true });
        }
    });

    it("stops the progress bar even when a source file fails to parse", async () => {
        expect.assertions(2);

        const workDirectory = mkdtempSync(join(tmpdir(), "generate-parse-fail-"));
        const sourceDirectory = join(workDirectory, "src");

        mkdirSync(sourceDirectory);
        // A comment with invalid YAML makes parseFileMulti throw mid-run.
        writeFileSync(
            join(sourceDirectory, "broken.ts"),
            "/**\n * @openapi\n * /pets:\n *   get:\n *  bad: indentation: here\n */\nexport const x = 1;\n",
        );

        try {
            await expect(generateCommand(".openapirc.js", [sourceDirectory], { config: join(fixturesDirectory, ".openapirc.js") })).rejects.toThrow();

            expect(multiBarStopMock).toHaveBeenCalled();
        } finally {
            rmSync(workDirectory, { force: true, recursive: true });
        }
    });

    it("seeds the spec from a base-definition file passed via the definition option", async () => {
        expect.assertions(1);

        const workDirectory = mkdtempSync(join(tmpdir(), "generate-definition-"));
        const definitionPath = join(workDirectory, "definition.json");
        const configPath = join(workDirectory, "config.cjs");

        writeFileSync(
            definitionPath,
            JSON.stringify({ info: { title: "From Definition", version: "9.9.9" }, openapi: "3.0.0" }),
        );
        // Config without swaggerDefinition.info so the definition file supplies it.
        writeFileSync(configPath, "module.exports = { exclude: [], swaggerDefinition: {} };\n");

        const writeFileSpy = vi.spyOn(fs, "writeFile");
        const consoleLogMock = vi.spyOn(console, "log").mockImplementation(() => undefined);

        try {
            await generateCommand(".openapirc.js", [join(fixturesDirectory, "routes")], {
                config: configPath,
                definition: definitionPath,
            });

            const [, contents] = writeFileSpy.mock.calls.at(-1) as [string, string];
            const parsed = JSON.parse(contents) as { info: { title: string } };

            expect(parsed.info.title).toBe("From Definition");
        } finally {
            consoleLogMock.mockRestore();
            rmSync(workDirectory, { force: true, recursive: true });
        }
    });
});
