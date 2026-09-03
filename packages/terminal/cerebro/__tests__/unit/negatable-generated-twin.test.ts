import { describe, expect, it } from "vitest";

import type { OptionDefinition } from "../../src/types/command";
import { addNegatableOptions } from "../../src/util/command-processing/option-processor";

const generatedTwin = (declared: OptionDefinition<unknown>): OptionDefinition<unknown> | undefined => {
    const command = { name: "init", options: [declared] };

    addNegatableOptions(command);

    return command.options.find((option) => option.name === "interactive");
};

describe("generated positive twin for a declared --no-x", () => {
    it("does not reuse the negative's description", () => {
        expect.assertions(2);

        // `vis init --help` listed `--no-interactive  Skip interactive prompts`
        // and then `--interactive  Skip interactive prompts` — the second line
        // meaning the opposite of what it said.
        const twin = generatedTwin({
            defaultValue: false,
            description: "Skip interactive prompts",
            name: "no-interactive",
            type: Boolean,
        });

        expect(twin?.description).not.toBe("Skip interactive prompts");
        expect(twin?.description).toBe("Inverse of --no-interactive.");
    });

    it("stays visible so it survives help and shell completion", () => {
        expect.assertions(1);

        // `hidden` is filtered from help, README generation and completion
        // alike, so hiding the twin would drop a working flag from all three.
        const twin = generatedTwin({
            defaultValue: false,
            description: "Skip interactive prompts",
            name: "no-interactive",
            type: Boolean,
        });

        expect(twin?.hidden).not.toBe(true);
    });

    it("does not copy the alias onto the twin", () => {
        expect.assertions(1);

        const twin = generatedTwin({
            alias: "n",
            defaultValue: false,
            description: "Skip interactive prompts",
            name: "no-interactive",
            type: Boolean,
        });

        expect(twin?.alias).toBeUndefined();
    });
});
