import { describe, it, expect } from "vitest";

import parseRawCommand from "../../../src/util/parse-raw-command";

describe("util/parse-raw-command", () => {
    it("should return an array of strings when a command string is passed", () => {
        const commandString = "command argument1 argument2";

        const result = parseRawCommand(commandString);

        expect(result).toEqual(["command", "argument1", "argument2"]);
    });

    it("should trim command arguments from process.argv", () => {
        // temporarily mock process.argv
        const backupArgv = process.argv.slice();
        process.argv = ["node", "script.js", "command", "argument1", "argument2"];

        const result = parseRawCommand(process.argv);

        // restore original process.argv
        process.argv = backupArgv;

        expect(result).toEqual(["command", "argument1", "argument2"]);
    });

    it("should return the command array unchanged if it does not match process.argv", () => {
        const commandArray = ["command", "argument1", "argument2"];

        const result = parseRawCommand(commandArray);

        expect(result).toEqual(commandArray);
    });
});
