// eslint-disable-next-line import/no-namespace
import * as fs from "node:fs";
import { join } from "node:path";
import {
    describe, expect, it, vi,
} from "vitest";

import generateCommand from "../../../src/cli/command/generate-command";

vi.mock("node:fs", async () => {
    return {
        ...(await import("node:fs")),
        writeFileSync: vi.fn(),
    };
});

// eslint-disable-next-line unicorn/prefer-module
const fixturesDirectory = `${__dirname}/../../../__fixtures__`;

describe("generate command", () => {
    it("throws an error when no config file is found", async () => {
        const paths = ["/path/to/dir"];
        // eslint-disable-next-line sonarjs/no-duplicate-string
        const options = { config: "/path/to/nonexistent/config.js" };

        // eslint-disable-next-line sonarjs/no-duplicate-string
        await expect(generateCommand(".openapirc.js", paths, options)).rejects.toThrow("No config file found, on: /path/to/nonexistent/config.js");
    });

    it("collects the correct files from the given directories", async () => {
        const writeFileSyncSpy = vi.spyOn(fs, "writeFileSync");
        const consoleLogMock = vi.spyOn(console, "log");

        await generateCommand(".openapirc.js", [fixturesDirectory], { config: join(fixturesDirectory, ".openapirc.js") });

        expect(writeFileSyncSpy).toMatchSnapshot();
        expect(consoleLogMock).toHaveBeenCalledWith('\nSwagger specification is ready, check the "swagger.json" file.');
    });
});
