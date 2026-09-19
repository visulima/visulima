/**
 * `vis release` discoverability + dispatch (visulima/visulima#863).
 *
 * Every release subcommand is registered as a nested `commandPath: ["release"]`
 * command. Two things fell out of that before the flat `release` umbrella
 * command existed:
 *
 *  1. `vis --help` never carried a `release` entry — only ~23 `release &lt;sub>`
 *     rows, in the last group of a long listing.
 *  2. `release ci release` has the leaf name `release`, so cerebro's
 *     name-keyed lookup resolved a bare `vis release` (and `vis release
 *     --help` / `vis help release`) onto the CI version-PR / publish flow.
 *
 * These tests pin both: the top-level listing names `release`, and the three
 * bare-path spellings render the subcommand tree instead of running CI.
 */

import { createCerebro } from "@visulima/cerebro";
import { describe, expect, it, vi } from "vitest";

import registerCommands from "../../src/register-commands";

const createLoggerMock = () => {
    return {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        log: vi.fn(),
        raw: vi.fn(),
        warn: vi.fn(),
    };
};

const runCli = async (argv: string[]): Promise<{ logger: ReturnType<typeof createLoggerMock>; output: string }> => {
    const logger = createLoggerMock();
    const cli = createCerebro("vis", { argv, logger: logger as unknown as Console, packageName: "vis", packageVersion: "0.0.0-test" });

    registerCommands(cli);

    await cli.run({ shouldExitProcess: false });

    const output = [...logger.raw.mock.calls, ...logger.log.mock.calls].flat().join("\n");

    return { logger, output };
};

// Strip ANSI so assertions match regardless of the ambient color support.
// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\u001B\[[\d;]*m/g;

const decolor = (value: string): string => value.replaceAll(ANSI_PATTERN, "");

describe("vis release discoverability", () => {
    it("lists `release` as its own entry in the top-level help", async () => {
        expect.assertions(3);

        const { logger, output } = await runCli(["--help"]);
        const plain = decolor(output);

        expect(logger.error).not.toHaveBeenCalled();
        // A dedicated group header, not just the nested `release <sub>` rows.
        expect(plain).toMatch(/\bRelease\b/);
        // The one-line umbrella entry: `release` followed by its description,
        // with no subcommand segment in between.
        expect(plain).toMatch(/^\s*release\s{2,}Version, changelog and publish workspace packages/m);
    });

    it.each([["release"], ["release", "--help"], ["help", "release"]])("renders the subcommand tree for `vis %s`", async (...argv: string[]) => {
        expect.assertions(4);

        const { logger, output } = await runCli(argv);
        const plain = decolor(output);

        expect(logger.error).not.toHaveBeenCalled();
        expect(plain).toContain("Subcommands");
        expect(plain).toContain("release doctor");
        // Regression guard: this used to render `vis release ci release`'s own
        // help (and, for the bare form, *run* it).
        expect(plain).not.toMatch(/Usage[\s\S]*vis release ci release/);
    });

    it("still resolves the nested `release ci release` by its full path", async () => {
        expect.assertions(2);

        const { logger, output } = await runCli(["release", "ci", "release", "--help"]);
        const plain = decolor(output);

        expect(logger.error).not.toHaveBeenCalled();
        expect(plain).toContain("vis release ci release");
    });
});
