import { describe, expect, it } from "vitest";

import { sanitizeAttribute, sanitizeCodeHtml, sanitizeHtml, sanitizeUrlAttribute } from "../../src/error-inspector/utils/sanitize";
import process, { getProcessPlatform, getProcessVersion } from "../../src/utils/process";
import revisionHash from "../../src/utils/revision-hash";
import runtime from "../../src/utils/runtimes";

describe("runtime detection on workerd", () => {
    it("should detect the workerd runtime from `navigator.userAgent`", () => {
        expect.assertions(1);

        expect(runtime).toBe("workerd");
    });

    it("should read `process` through the shim without throwing", () => {
        expect.assertions(3);

        expect(() => getProcessPlatform()).not.toThrow();
        expect(() => getProcessVersion()).not.toThrow();
        expect(process.versions).toBeDefined();
    });

    it("should return undefined for a key present on neither `process` nor the shim", () => {
        expect.assertions(1);

        expect((process as unknown as Record<string, unknown>).thisKeyDoesNotExist).toBeUndefined();
    });

    it("should tolerate `process.env` lookups on the solution-finder path", () => {
        expect.assertions(1);

        expect(() => process.env?.DEBUG).not.toThrow();
    });
});

describe("hashing on workerd", () => {
    it("should hash with `node:crypto` under nodejs_compat", () => {
        expect.assertions(2);

        // `createHash` is one of the `node:crypto` primitives workerd implements, so the revision
        // hash keeps working; Web Crypto is the portable alternative if that ever changes.
        expect(revisionHash("abc")).toBe("ba7816bf8f01cfea");
        expect(revisionHash("abc")).toHaveLength(16);
    });

    it("should reject a non-string input", () => {
        expect.assertions(1);

        expect(() => revisionHash(1 as unknown as string)).toThrow(TypeError);
    });

    it("should offer Web Crypto as the portable alternative", async () => {
        expect.assertions(2);

        // eslint-disable-next-line n/no-unsupported-features/node-builtins -- Web Crypto is always present on workerd
        expect(crypto.randomUUID()).toBeTypeOf("string");
        // eslint-disable-next-line n/no-unsupported-features/node-builtins -- Web Crypto is always present on workerd
        await expect(crypto.subtle.digest("SHA-256", new TextEncoder().encode("abc"))).resolves.toBeInstanceOf(ArrayBuffer);
    });
});

describe("sanitization fallback on workerd", () => {
    it("should escape markup when DOMPurify cannot load", () => {
        expect.assertions(2);

        // Documented degradation: with no DOM there is no DOMPurify, so everything is entity-escaped
        // instead of sanitized. Escaping is the stricter of the two — no markup survives it.
        expect(sanitizeHtml("<script>alert(1)</script>")).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
        expect(sanitizeCodeHtml("<span class=\"token\">x</span>")).not.toContain("<span");
    });

    it("should escape quotes so an attribute value cannot break out", () => {
        expect.assertions(2);

        expect(sanitizeAttribute("x\" onfocus=\"alert(1)")).not.toContain("\" onfocus");
        expect(sanitizeAttribute("x\" onfocus=\"alert(1)")).toContain("&quot;");
    });

    it("should keep allowed URLs usable instead of collapsing every link to `#`", () => {
        expect.assertions(3);

        expect(sanitizeUrlAttribute("https://example.com/a")).toBe("https://example.com/a");
        expect(sanitizeUrlAttribute("/local/path")).toBe("/local/path");
        // eslint-disable-next-line no-script-url -- the point of the assertion is that this scheme is rejected
        expect(sanitizeUrlAttribute("javascript:alert(1)")).toBe("#");
    });

    it("should reject a `data:` URL", () => {
        expect.assertions(1);

        expect(sanitizeUrlAttribute("data:text/html,<script>alert(1)</script>")).toBe("#");
    });
});
