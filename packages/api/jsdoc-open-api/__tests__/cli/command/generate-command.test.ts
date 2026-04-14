// eslint-disable-next-line import/no-namespace
import * as fs from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import generateCommand from "../../../src/cli/command/generate-command";

vi.mock(import("node:fs/promises"), async () => {
    return {
        ...await import("node:fs/promises"),
        writeFile: vi.fn(),
    };
});

const fixturesDirectory = `${__dirname}/../../../__fixtures__`;

describe("generate command", () => {
    it("throws an error when no config file is found", async () => {
        expect.assertions(1);

        const paths = ["/path/to/dir"];

        const options = { config: "/path/to/nonexistent/config.js" };

        await expect(generateCommand(".openapirc.js", paths, options)).rejects.toThrow("No config file found, on: /path/to/nonexistent/config.js");
    });

    it("collects the correct files from the given directories", async () => {
        expect.assertions(2);

        const writeFileSpy = vi.spyOn(fs, "writeFile");
        const consoleLogMock = vi.spyOn(console, "log");

        await generateCommand(".openapirc.js", [fixturesDirectory], { config: join(fixturesDirectory, ".openapirc.js") });

        expect(writeFileSpy).toMatchSnapshot();
        expect(consoleLogMock).toHaveBeenCalledExactlyOnceWith("\nSwagger specification is ready, check the \"swagger.json\" file.");
    });
});
