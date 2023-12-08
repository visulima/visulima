import { describe, it, expect } from "vitest";

import commandLineCommands from "../../../src/util/command-line-commands";

describe("util/command-line-commands", () => {
    it("should parse given argv for the correct command and option", () => {
        const commands = ["eat", "sleep"];

        let clc = commandLineCommands(commands, ["eat", "--food", "peas"]);

        expect(clc.command).toBe("eat");
        expect(clc.argv).toEqual(["--food", "peas"]);

        clc = commandLineCommands(commands, ["sleep", "--hours", "2"]);

        expect(clc.command).toBe("sleep");
        expect(clc.argv).toEqual(["--hours", "2"]);
    });

    it("should throw a error if no commands defined", () => {
        expect(() => {
            commandLineCommands([], ["eat"]);
        }).toThrow();
        expect(() => {
            commandLineCommands([], []);
        }).toThrow();
    });

    it("should not throw if null as command is specified", () => {
        const commands = [null];

        let clc;

        clc = commandLineCommands(commands, []);
        expect(clc.command).toBe(null);
        expect(clc.argv).toEqual([]);

        clc = commandLineCommands(commands, ["--flag"]);
        expect(clc.command).toBe(null);
        expect(clc.argv).toEqual(["--flag"]);
    });

    it("invalid command", () => {
        const commands = ["eat", "sleep"];

        const error: Error & { command?: string | null | undefined } = new Error(`Command not recognised: cheese`);
        error.command = "cheese";
        error.name = "INVALID_COMMAND";

        expect(() => { commandLineCommands(commands, ["cheese", "--food", "peas"]); }).toThrow(error);
    });
});
