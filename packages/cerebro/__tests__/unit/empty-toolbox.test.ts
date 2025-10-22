import { describe, expect, it, vi } from "vitest";

import type { CommandSection } from "../../src/@types";
import EmptyToolbox from "../../src/empty-toolbox";

describe("emptyToolbox", () => {
    it("should create an instance with the given command name and command", () => {
        expect.assertions(2);

        const commandName = "testCommand";
        const command = { execute: vi.fn(), name: "test" };
        const toolbox = new EmptyToolbox(commandName, command);

        expect(toolbox.commandName).toBe(commandName);
        expect(toolbox.command).toBe(command);
    });

    it("should allow setting and getting properties", () => {
        expect.assertions(4);

        const toolbox = new EmptyToolbox("testCommand", { execute: vi.fn(), name: "test" });
        const runtime = {
            addCommand() {
                return undefined;
            },
            addExtension() {
                return undefined;
            },
            enableUpdateNotifier() {
                return undefined;
            },
            getCliName(): string {
                return "";
            },
            getCommands() {
                return undefined;
            },
            getCommandSection(): CommandSection {
                return undefined;
            },
            getCwd(): string {
                return "";
            },
            getPackageName(): string | undefined {
                return undefined;
            },
            getPackageVersion: () => "1.0.0",
            async run(): Promise<void> {
                return undefined;
            },
            setCommandSection() {
                return undefined;
            },
            setDefaultCommand() {
                return undefined;
            },
        };

        toolbox.argv = ["arg1", "arg2"];
        toolbox.options = { option1: "value1" };
        toolbox.argument = ["argName", "argValue"];
        toolbox.runtime = runtime;

        expect(toolbox.argv).toStrictEqual(["arg1", "arg2"]);
        expect(toolbox.options).toStrictEqual({ option1: "value1" });
        expect(toolbox.argument).toStrictEqual(["argName", "argValue"]);
        expect(toolbox.runtime).toStrictEqual(runtime);
    });

    it("should not throw error when accessing undefined properties", () => {
        expect.assertions(2);

        const toolbox = new EmptyToolbox("testCommand", { execute: vi.fn(), name: "test" });

        expect(() => {
            toolbox.nonexistentProperty;
        }).not.toThrow();

        expect(() => {
            toolbox.nonexistentProperty = "value";
        }).not.toThrow();
    });
});
