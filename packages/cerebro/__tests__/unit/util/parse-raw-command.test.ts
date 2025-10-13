import { describe, expect, it } from "vitest";

import parseRawCommand from "../../../src/util/parse-raw-command";

describe("util/parse-raw-command", () => {
    it("should return an array of strings when a command string is passed", () => {
        expect.assertions(1);

        const commandString = "command argument1 argument2";

        const result = parseRawCommand(commandString);

        expect(result).toStrictEqual(["command", "argument1", "argument2"]);
    });

    it("should trim command arguments from process.argv", () => {
        expect.assertions(1);

        // temporarily mock process.argv
        const backupArgv = [...process.argv];

        process.argv = ["node", "script.js", "command", "argument1", "argument2"];

        const result = parseRawCommand(process.argv);

        // restore original process.argv
        process.argv = backupArgv;

        expect(result).toStrictEqual(["command", "argument1", "argument2"]);
    });

    it("should return the command array unchanged if it does not match process.argv", () => {
        expect.assertions(1);

        const commandArray = ["command", "argument1", "argument2"];

        const result = parseRawCommand(commandArray);

        expect(result).toStrictEqual(commandArray);
    });
});
