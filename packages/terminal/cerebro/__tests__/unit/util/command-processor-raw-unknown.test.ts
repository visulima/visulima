/**
 * `toolbox.rawUnknown` holds the tokens command-line-args couldn't
 * assign to a defined option — typically everything after `--`.
 * These tests pin the shape so consumers (e.g. `vis create`'s
 * `--template react-ts` passthrough to `create-vite`) can rely on it.
 */

import type { CommandLineOptions } from "@visulima/command-line-args";
import { describe, expect, it } from "vitest";

import { POSITIONALS_KEY } from "../../../src/constants";
import type { Command as ICommand } from "../../../src/types/command";
import { prepareToolbox } from "../../../src/util/command-processing/command-processor";

const command: ICommand = {
    execute: () => {},
    name: "noop",
};

describe("util/command-processor — rawUnknown", () => {
    it("exposes _unknown tokens on the toolbox", () => {
        expect.assertions(1);

        const parsedArgs: CommandLineOptions = {
            _all: {},
            _unknown: ["--template", "react-ts"],
            positionals: { [POSITIONALS_KEY]: [] },
        };

        const toolbox = prepareToolbox(command, parsedArgs, {}, {});

        expect(toolbox.rawUnknown).toStrictEqual(["--template", "react-ts"]);
    });

    it("returns an empty array when there were no unknown tokens", () => {
        expect.assertions(1);

        const parsedArgs: CommandLineOptions = {
            _all: {},
            positionals: { [POSITIONALS_KEY]: [] },
        };

        const toolbox = prepareToolbox(command, parsedArgs, {}, {});

        expect(toolbox.rawUnknown).toStrictEqual([]);
    });

    it("returns a shallow copy so callers cannot mutate parser state", () => {
        expect.assertions(2);

        const unknown = ["--foo=bar"];
        const parsedArgs: CommandLineOptions = {
            _all: {},
            _unknown: unknown,
            positionals: { [POSITIONALS_KEY]: [] },
        };

        const toolbox = prepareToolbox(command, parsedArgs, {}, {});

        (toolbox.rawUnknown as string[]).push("--tampered");

        expect(unknown).toStrictEqual(["--foo=bar"]);
        expect(toolbox.rawUnknown).toStrictEqual(["--foo=bar", "--tampered"]);
    });
});
