import type { AnyCommandInput } from "@visulima/cerebro";
import { Cerebro as Cli } from "@visulima/cerebro";
import { describe, expect, it, vi } from "vitest";

import releasePreCommand from "../../src/commands/release/pre";
import releaseStageCommand from "../../src/commands/release/stage";
import stagedCommand from "../../src/commands/staged";
import updateCommand from "../../src/commands/update";

/**
 * Run a command through the real parser and hand back its resolved options, so
 * these assertions cover cerebro's negation folding end to end rather than a
 * hand-built options object.
 */
const optionsFor = async (command: AnyCommandInput, argv: string[]): Promise<Record<string, unknown>> => {
    const execute = vi.fn();
    const cli = new Cli("vis", { argv: [command.name, ...argv] });

    cli.addCommand({ ...command, commandPath: undefined, execute, loader: undefined });

    await cli.run({ shouldExitProcess: false });

    return (execute.mock.calls[0] as [{ options: Record<string, unknown> }])[0].options;
};

describe("documented negations reach the handler", () => {
    it("update --no-install and --no-security turn their features off", async () => {
        expect.assertions(2);

        await expect(optionsFor(updateCommand, ["--no-install"])).resolves.toMatchObject({ install: false });
        await expect(optionsFor(updateCommand, ["--no-security"])).resolves.toMatchObject({ security: false });
    });

    it("update leaves both undefined when neither flag is passed", async () => {
        expect.assertions(2);

        // The handler falls back to config here (`options.install ?? true`), so
        // a default on either half would quietly win over `vis.config`.
        const options = await optionsFor(updateCommand, []);

        expect(options.install).toBeUndefined();
        expect(options.security).toBeUndefined();
    });

    it("staged --no-stash disables the backup stash", async () => {
        expect.assertions(2);

        await expect(optionsFor(stagedCommand, [])).resolves.toMatchObject({ stash: true });
        await expect(optionsFor(stagedCommand, ["--no-stash"])).resolves.toMatchObject({ stash: false });
    });

    it("release stage --no-commit and --no-push are honoured", async () => {
        expect.assertions(2);

        await expect(optionsFor(releaseStageCommand, ["--no-commit"])).resolves.toMatchObject({ commit: false });
        await expect(optionsFor(releaseStageCommand, ["--no-push"])).resolves.toMatchObject({ push: false });
    });

    it("release pre --no-commit and --no-push are honoured", async () => {
        expect.assertions(2);

        await expect(optionsFor(releasePreCommand, ["--no-commit"])).resolves.toMatchObject({ commit: false });
        await expect(optionsFor(releasePreCommand, ["--no-push"])).resolves.toMatchObject({ push: false });
    });
});
