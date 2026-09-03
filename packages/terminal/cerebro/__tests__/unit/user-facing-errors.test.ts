import { describe, expect, it, vi } from "vitest";

import { Cerebro as Cli } from "../../src";

/**
 * Bad input must reach the user as its message, not as a stack.
 *
 * These errors are raised inside `#executeCommandInternal`, before the
 * plugin lifecycle exists — so classifying them only in `errorHandlerPlugin`
 * fixed nothing, and nothing caught that because no test exercised the path.
 */
const runWith = async (argv: string[]): Promise<unknown[]> => {
    const logged: unknown[] = [];
    const logger = {
        debug: () => undefined,
        error: (...args: unknown[]) => logged.push(...args),
        info: () => undefined,
        log: () => undefined,
        warn: () => undefined,
    };

    const cli = new Cli("acme", { argv, logger: logger as unknown as Console, strictOptions: true });

    cli.addCommand({
        description: "build it",
        execute: () => undefined,
        name: "build",
        options: [{ description: "Output format", name: "format", type: String }],
    });

    try {
        await cli.run({ shouldExitProcess: false });
    } catch {
        // The caller re-throws after rendering; rendering is what we assert.
    }

    return logged;
};

describe("user-facing error rendering", () => {
    it("renders an unknown option as its message, not an Error with a stack", async () => {
        expect.assertions(3);

        const logged = await runWith(["build", "--json"]);
        const rendered = logged.find((entry) => typeof entry === "string");

        expect(rendered).toBeDefined();
        expect(String(rendered)).toContain("--json");
        // An `Error` instance here is what produced eight frames of bundle
        // internals above the one line the user needed.
        expect(logged.some((entry) => entry instanceof Error)).toBe(false);
    });

    it("keeps the hint alongside the message", async () => {
        expect.assertions(1);

        const logged = await runWith(["build", "--forma"]);
        const rendered = logged.filter((entry) => typeof entry === "string").join("\n");

        // The did-you-mean hint has to survive alongside the message.
        expect(rendered).toContain("format");
    });
});
