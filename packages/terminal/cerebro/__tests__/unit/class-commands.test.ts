import { describe, expect, it } from "vitest";

import { Cerebro as Cli } from "../../src";

class RecordCommand {
    public readonly name = "cls";

    public readonly options = { foo: { type: String } };

    public readonly seen: unknown[] = [];

    public execute({ options }: { options: Record<string, unknown> }): void {
        this.seen.push(options.foo);
    }
}

describe("class-based commands", () => {
    it("keeps prototype methods when a record definition is converted", async () => {
        expect.assertions(1);

        const command = new RecordCommand();
        const cli = new Cli("MyCLI", { argv: ["cls", "--foo", "bar"] });

        // A bare spread in normalization would drop `execute` and fail
        // registration with a message pointing at the wrong thing.
        cli.addCommand(command);

        await cli.run({ shouldExitProcess: false });

        expect(command.seen).toStrictEqual(["bar"]);
    });
});
