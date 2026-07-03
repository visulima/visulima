/**
 * `toolbox.rawUnknown` holds the tokens command-line-args couldn't
 * assign to a defined option — typically everything after `--`.
 * These tests pin the shape so consumers (e.g. `vis create`'s
 * `--template react-ts` passthrough to `create-vite`) can rely on it.
 */

import type { CommandLineOptions } from "@visulima/command-line-args";
import { describe, expect, it, vi } from "vitest";

import { POSITIONALS_KEY } from "../../../src/constants";
import type { Command as ICommand } from "../../../src/types/command";
import { loadLazyHandler, prepareToolbox, processCommandArgs } from "../../../src/util/command-processing/command-processor";

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

describe("util/command-processor — processCommandArgs", () => {
    it("builds alias lookups for options that declare a single-character alias", () => {
        expect.assertions(1);

        const aliasCommand: ICommand = {
            execute: () => {},
            name: "build",
            options: [
                { alias: "v", name: "verbose", type: Boolean },
                { alias: "o", name: "output", type: String },
            ],
        };

        // String aliases exercise the non-array branch of buildOptionMaps (wrap into a
        // single-element array) plus the alias loop body that registers each alias.
        const { parsedArgs } = processCommandArgs(aliasCommand, ["-v", "-o", "dist"], []);

        expect((parsedArgs as Record<string, unknown>).output).toBe("dist");
    });

    it("throws when an argument declares both multiple and lazyMultiple", () => {
        expect.assertions(1);

        const conflictCommand: ICommand = {
            execute: () => {},
            name: "build",
            options: [{ lazyMultiple: true, multiple: true, name: "file", type: String }],
        };

        expect(() => processCommandArgs(conflictCommand, [], [])).toThrow("cannot have both multiple and lazyMultiple options");
    });
});

describe("util/command-processor — loadLazyHandler", () => {
    it("throws CommandLoaderError when the command has neither execute nor loader", async () => {
        expect.assertions(1);

        const broken = { name: "broken" } as unknown as ICommand;

        await expect(loadLazyHandler(broken)).rejects.toThrow("no execute or loader defined");
    });

    it("caches the resolved handler on the command after the first load", async () => {
        expect.assertions(3);

        const handler = vi.fn();
        const loader = vi.fn().mockResolvedValue({ default: handler });
        const lazy = { loader, name: "lazy" } as unknown as ICommand;

        const first = await loadLazyHandler(lazy);
        const second = await loadLazyHandler(lazy);

        expect(first).toBe(handler);
        expect(second).toBe(handler);
        // The loader only runs once; the second call returns the cached __resolvedExecute__.
        expect(loader).toHaveBeenCalledTimes(1);
    });

    it("wraps loader failures in a CommandLoaderError", async () => {
        expect.assertions(1);

        const lazy = {
            loader: () => Promise.reject(new Error("module blew up")),
            name: "lazy",
        } as unknown as ICommand;

        await expect(loadLazyHandler(lazy)).rejects.toThrow("module blew up");
    });

    it("throws when the loaded module has no default-exported function", async () => {
        expect.assertions(1);

        const lazy = {
            loader: () => Promise.resolve({ default: "not-a-function" }),
            name: "lazy",
        } as unknown as ICommand;

        await expect(loadLazyHandler(lazy)).rejects.toThrow("default-exported handler function");
    });
});
