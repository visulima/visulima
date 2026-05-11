import { describe, expect, it } from "vitest";

import {
    AdvisoryDbNotFoundError,
    AdvisorySourceNotAllowedError,
    DEFAULT_ADVISORY_SOURCE,
    resolveAdvisoryDbPath,
    validateAdvisorySource,
} from "../../src/security/advisories";

describe(validateAdvisorySource, () => {
    it("accepts the built-in OSV bucket", () => {
        expect.assertions(1);

        const url = validateAdvisorySource(DEFAULT_ADVISORY_SOURCE);

        expect(url.host).toBe("osv-vulnerabilities.storage.googleapis.com");
    });

    it("rejects http:// sources", () => {
        expect.assertions(1);

        expect(() => validateAdvisorySource("http://osv-vulnerabilities.storage.googleapis.com")).toThrow(AdvisorySourceNotAllowedError);
    });

    it("rejects hosts not in the built-in allowlist", () => {
        expect.assertions(1);

        expect(() => validateAdvisorySource("https://attacker.example.com")).toThrow(AdvisorySourceNotAllowedError);
    });

    it("accepts a user-declared allowlisted host", () => {
        expect.assertions(1);

        const url = validateAdvisorySource("https://mirror.example.com", ["mirror.example.com"]);

        expect(url.host).toBe("mirror.example.com");
    });

    it("rejects malformed URLs", () => {
        expect.assertions(1);

        expect(() => validateAdvisorySource("not-a-url")).toThrow(AdvisorySourceNotAllowedError);
    });
});

describe(resolveAdvisoryDbPath, () => {
    it("returns a path containing the advisories/db.sqlite suffix", () => {
        expect.assertions(2);

        const path = resolveAdvisoryDbPath(process.cwd());

        expect(path).toContain("advisories");
        expect(path).toMatch(/db\.sqlite$/);
    });
});

describe(AdvisoryDbNotFoundError, () => {
    it("carries the path in the message and the typed cause", () => {
        expect.assertions(3);

        const error = new AdvisoryDbNotFoundError("/tmp/no/such/db.sqlite");

        expect(error.message).toContain("/tmp/no/such/db.sqlite");
        expect(error.message).toContain("vis advisories sync");
        expect(error.cause).toBe("DB_NOT_FOUND");
    });
});
