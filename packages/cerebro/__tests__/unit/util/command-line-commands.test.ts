import { describe, expect, it } from "vitest";

import commandLineCommands from "../../../src/util/command-line-commands";

describe("util/command-line-commands", () => {
    it("should parse given argv for the correct command and option", () => {
        expect.assertions(4);

        const commands = ["eat", "sleep"];

        let clc = commandLineCommands(commands, ["eat", "--food", "peas"]);

        expect(clc.command).toBe("eat");
        expect(clc.argv).toStrictEqual(["--food", "peas"]);

        clc = commandLineCommands(commands, ["sleep", "--hours", "2"]);

        expect(clc.command).toBe("sleep");
        expect(clc.argv).toStrictEqual(["--hours", "2"]);
    });

    it("should throw a error if no commands defined", () => {
        expect.assertions(2);

        expect(() => {
            commandLineCommands([], ["eat"]);
        }).toThrow("Command not recognised: eat");
        expect(() => {
            commandLineCommands([], []);
        }).toThrow("Command not recognised: null");
    });

    it("should not throw if null as command is specified", () => {
        expect.assertions(4);

        const commands = [null];

        let clc;

        clc = commandLineCommands(commands, []);

        expect(clc.command).toBeNull();
        expect(clc.argv).toStrictEqual([]);

        clc = commandLineCommands(commands, ["--flag"]);

        expect(clc.command).toBeNull();
        expect(clc.argv).toStrictEqual(["--flag"]);
    });

    it("invalid command", () => {
        expect.assertions(1);

        const commands = ["eat", "sleep"];

        const error: Error & { command?: string | null | undefined } = new Error(`Command not recognised: cheese`);

        error.command = "cheese";
        error.name = "INVALID_COMMAND";

        expect(() => {
            commandLineCommands(commands, ["cheese", "--food", "peas"]);
        }).toThrow(error);
    });
});
