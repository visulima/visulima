import { describe, expect, it, vi } from "vitest";

import { Cerebro as Cli } from "../../src";

class GetterCommand {
    public readonly execute = vi.fn();

    public readonly name = "gc";

    // eslint-disable-next-line class-methods-use-this
    public get options(): undefined {
        return undefined;
    }
}

describe("commands exposing definitions through a getter", () => {
    it("registers without attempting to write the accessor", () => {
        expect.assertions(1);

        const cli = new Cli("MyCLI");

        // Normalization used to assign `command.options` unconditionally, which
        // throws on an accessor-only property.
        expect(() => cli.addCommand(new GetterCommand())).not.toThrow();
    });
});
