import { describe, expect, it, vi } from "vitest";

import type { Toolbox } from "../../src";
import { Cerebro as Cli } from "../../src";

const CONFLICTS_BUILTIN_RE = /conflicts with a built-in global option/;
const CONFLICTS_BUILTIN_ALIAS_RE = /conflicts with a built-in global option alias/;
const ALREADY_ADDED_RE = /has already been added/;

describe("addGlobalOption", () => {
    it("should add a custom global option", () => {
        expect.assertions(1);

        const cli = new Cli("test-cli");

        cli.addGlobalOption({
            description: "Override working directory",
            name: "cwd",
            type: String,
        });

        const options = cli.getGlobalOptions();
        const cwdOption = options.find((o) => o.name === "cwd");

        expect(cwdOption).toBeDefined();
    });

    it("should include custom global options alongside built-in ones", () => {
        expect.assertions(2);

        const cli = new Cli("test-cli");

        const builtInCount = cli.getGlobalOptions().length;

        cli.addGlobalOption({
            description: "Override working directory",
            name: "cwd",
            type: String,
        });

        const allOptions = cli.getGlobalOptions();

        expect(allOptions).toHaveLength(builtInCount + 1);
        expect(allOptions.some((o) => o.name === "cwd")).toBe(true);
    });

    it("should set group to 'global' on added options", () => {
        expect.assertions(1);

        const cli = new Cli("test-cli");

        cli.addGlobalOption({
            description: "Custom option",
            name: "my-option",
            type: String,
        });

        const option = cli.getGlobalOptions().find((o) => o.name === "my-option");

        expect(option?.group).toBe("global");
    });

    it("should throw when adding an option that conflicts with a built-in option", () => {
        expect.assertions(1);

        const cli = new Cli("test-cli");

        expect(() => {
            cli.addGlobalOption({
                description: "Duplicate verbose",
                name: "verbose",
                type: Boolean,
            });
        }).toThrow(CONFLICTS_BUILTIN_RE);
    });

    it("should throw when adding an option with an alias that conflicts with a built-in alias", () => {
        expect.assertions(1);

        const cli = new Cli("test-cli");

        expect(() => {
            cli.addGlobalOption({
                alias: "h",
                description: "Conflicts with help alias",
                name: "my-help",
                type: Boolean,
            });
        }).toThrow(CONFLICTS_BUILTIN_ALIAS_RE);
    });

    it("should throw when adding a duplicate custom global option", () => {
        expect.assertions(1);

        const cli = new Cli("test-cli");

        cli.addGlobalOption({
            description: "First",
            name: "cwd",
            type: String,
        });

        expect(() => {
            cli.addGlobalOption({
                description: "Duplicate",
                name: "cwd",
                type: String,
            });
        }).toThrow(ALREADY_ADDED_RE);
    });

    it("should support method chaining", () => {
        expect.assertions(1);

        const cli = new Cli("test-cli");

        const result = cli
            .addGlobalOption({ description: "First", name: "opt-a", type: String })
            .addGlobalOption({ description: "Second", name: "opt-b", type: Boolean });

        expect(result).toBe(cli);
    });

    it("should make global options available in command execution", async () => {
        expect.assertions(1);

        const execute = vi.fn().mockResolvedValue(undefined);

        const cli = new Cli("test-cli", { argv: ["hello", "--cwd", "/tmp"] });

        cli.addGlobalOption({
            description: "Override working directory",
            name: "cwd",
            type: String,
        });

        cli.addCommand({
            description: "Test command",
            execute,
            name: "hello",
        });

        await cli.run({ shouldExitProcess: false });

        const toolbox = execute.mock.calls[0][0] as Toolbox;

        expect(toolbox.options.cwd).toBe("/tmp");
    });
});
