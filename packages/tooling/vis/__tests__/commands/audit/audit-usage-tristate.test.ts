import { Cerebro as Cli } from "@visulima/cerebro";
import { describe, expect, it, vi } from "vitest";

import auditCommand from "../../../src/commands/audit";

/**
 * Resolve `--usage` the way the CLI does, so the assertions cover the parser's
 * negation folding rather than a hand-built options object.
 */
const parseUsage = async (argv: string[]): Promise<unknown> => {
    const execute = vi.fn();
    const cli = new Cli("vis", { argv });

    cli.addCommand({ ...auditCommand, execute, loader: undefined });

    await cli.run({ shouldExitProcess: false });

    return (execute.mock.calls[0] as [{ options: Record<string, unknown> }])[0].options.usage;
};

describe("vis audit --usage", () => {
    it("stays undefined when neither flag is passed", async () => {
        expect.assertions(1);

        // `policies.vulnerability.usage.enabled` can only decide while this is
        // `undefined`. A `defaultValue` on either half pins it to a boolean and
        // makes that config unreachable.
        await expect(parseUsage(["audit"])).resolves.toBeUndefined();
    });

    it("is true for --usage and false for --no-usage", async () => {
        expect.assertions(2);

        await expect(parseUsage(["audit", "--usage"])).resolves.toBe(true);
        await expect(parseUsage(["audit", "--no-usage"])).resolves.toBe(false);
    });
});
