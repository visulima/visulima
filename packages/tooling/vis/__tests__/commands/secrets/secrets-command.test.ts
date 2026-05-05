import { describe, expect, it } from "vitest";

import secretsCommand from "../../../src/commands/secrets";

describe("secrets command", () => {
    it("declares its name", () => {
        expect.assertions(1);
        expect(secretsCommand.name).toBe("secrets");
    });

    it("is grouped under Security", () => {
        expect.assertions(1);
        expect(secretsCommand.group).toBe("Security");
    });

    it("accepts paths as a variadic argument", () => {
        expect.assertions(2);
        expect(secretsCommand.argument?.name).toBe("paths");
        expect(secretsCommand.argument?.type).toBe(String);
    });

    it("exposes the expected flags", () => {
        expect.assertions(1);

        const names = (secretsCommand.options ?? []).map((option) => option.name);

        expect(names).toStrictEqual(
            expect.arrayContaining(["config", "format", "baseline", "redact", "include-hidden", "no-gitignore", "max-size", "update-baseline"]),
        );
    });

    it("provides usage examples", () => {
        expect.assertions(1);

        expect((secretsCommand.examples ?? []).length).toBeGreaterThan(0);
    });
});
