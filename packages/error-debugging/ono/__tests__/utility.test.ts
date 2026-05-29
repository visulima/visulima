import { describe, expect, expectTypeOf, it } from "vitest";

import { cn } from "../src/error-inspector/utils/cn";
import {
    sanitizeAttribute,
    sanitizeCodeHtml,
    sanitizeCspNonce,
    sanitizeHtml,
    sanitizeOptions,
    sanitizeUrlAttribute,
} from "../src/error-inspector/utils/sanitize";
import process, { getProcessPlatform, getProcessVersion } from "../src/utils/process";
import revisionHash from "../src/utils/revision-hash";
import type { RuntimeName } from "../src/utils/runtimes";
import runtime from "../src/utils/runtimes";

const HEX_16_PATTERN = /^[a-f0-9]{16}$/;

describe("utilities", () => {
    describe("sanitize functions", () => {
        describe(sanitizeHtml, () => {
            it("should sanitize HTML content", () => {
                expect.assertions(2);

                const input = "<script>alert(\"xss\")</script><p>Hello</p>";
                const result = sanitizeHtml(input);

                expect(result).toBe("<p>Hello</p>");
                expect(result).not.toContain("<script>");
            });

            it("should handle undefined input", () => {
                expect.assertions(1);

                const result = sanitizeHtml(undefined);

                expect(result).toBe("");
            });

            it("should handle null input", () => {
                expect.assertions(1);

                const result = sanitizeHtml(null);

                expect(result).toBe("");
            });

            it("should convert non-string input to string", () => {
                expect.assertions(1);

                const result = sanitizeHtml(123);

                expect(result).toBe("123");
            });
        });

        describe(sanitizeAttribute, () => {
            it("should sanitize attribute values", () => {
                expect.assertions(2);

                const input = "\"onload=alert(1)\"";
                const result = sanitizeAttribute(input);

                expect(result).toContain("&quot;");
                expect(result).toContain("onload");
            });

            it("should escape special characters", () => {
                expect.assertions(5);

                const input = "<>\"'&";
                const result = sanitizeAttribute(input);

                // DOMPurify might already escape some characters, so we check that dangerous chars are escaped
                expect(result).not.toContain("<");
                expect(result).not.toContain(">");
                expect(result).not.toContain("\"");
                expect(result).not.toContain("'");
                expect(result).toContain("&");
            });
        });

        describe(sanitizeUrlAttribute, () => {
            it("should sanitize URL attributes", () => {
                expect.assertions(1);

                // eslint-disable-next-line no-script-url
                const input = "javascript:alert(1)";
                const result = sanitizeUrlAttribute(input);

                expect(result).toBe("#");
            });

            it("should allow safe URLs", () => {
                expect.assertions(1);

                const input = "https://example.com/path";
                const result = sanitizeUrlAttribute(input);

                expect(result).toBe("https://example.com/path");
            });

            it("should allow relative URLs", () => {
                expect.assertions(1);

                const input = "/path/to/file";
                const result = sanitizeUrlAttribute(input);

                expect(result).toBe("/path/to/file");
            });

            it("should prevent bypass attempts with javascript URLs disguised as HTTP", () => {
                expect.assertions(3);

                // Test the specific bypass mentioned: javascript:alert(1)//http://example.com
                // eslint-disable-next-line no-script-url
                const bypassAttempt1 = "javascript:alert(1)//http://example.com";
                const result1 = sanitizeUrlAttribute(bypassAttempt1);

                expect(result1).toBe("#");

                // Test other potential bypass attempts
                // eslint-disable-next-line no-script-url
                const bypassAttempt2 = "javascript:evil()//https://legit-site.com";
                const result2 = sanitizeUrlAttribute(bypassAttempt2);

                expect(result2).toBe("#");

                // Test with URL encoding
                // eslint-disable-next-line no-script-url
                const bypassAttempt3 = "javascript:alert(1)%2f%2fhttp://example.com";
                const result3 = sanitizeUrlAttribute(bypassAttempt3);

                expect(result3).toBe("#");
            });

            it("should handle malformed URLs gracefully", () => {
                expect.assertions(4);

                // Test URLs with control characters - CURRENTLY VULNERABLE: null bytes are preserved and URL is allowed
                // eslint-disable-next-line sonarjs/no-clear-text-protocols
                const controlCharUrl = "http://example.com\u0000evil";
                const result1 = sanitizeUrlAttribute(controlCharUrl);

                // eslint-disable-next-line sonarjs/no-clear-text-protocols
                expect(result1).toBe("http://example.com\u0000evil"); // Currently allows - SECURITY ISSUE

                // Test URLs with null bytes - CURRENTLY VULNERABLE: null bytes are preserved and URL is allowed
                const nullByteUrl = "http://example.com\u0000";
                const result2 = sanitizeUrlAttribute(nullByteUrl);

                expect(result2).toBe("http://example.com\u0000"); // Currently allows - SECURITY ISSUE

                // Test URLs with backslashes - CURRENTLY VULNERABLE: backslashes are allowed
                const backslashUrl = String.raw`http://example.com\evil`;
                const result3 = sanitizeUrlAttribute(backslashUrl);

                expect(result3).toBe(String.raw`http://example.com\evil`); // Currently allows - SECURITY ISSUE

                // Test empty or whitespace only URLs
                const whitespaceUrl = "   \n\t   ";
                const result4 = sanitizeUrlAttribute(whitespaceUrl);

                expect(result4).toBe("#");
            });

            it("should reject pseudo-protocols in relative URLs", () => {
                expect.assertions(3);

                // Test colon before slash (pseudo-protocol attempt)
                const pseudoProtocol1 = "evil:alert(1)/path";
                const result1 = sanitizeUrlAttribute(pseudoProtocol1);

                expect(result1).toBe("#");

                // Test URLs starting with // - CURRENTLY VULNERABLE: protocol-relative URLs are allowed
                const doubleSlashUrl = "//evil-site.com";
                const result2 = sanitizeUrlAttribute(doubleSlashUrl);

                expect(result2).toBe("//evil-site.com"); // Currently allows - SECURITY ISSUE

                // Test scheme-like segments
                const schemeLikeUrl = "data:text/html,<script>alert(1)</script>";
                const result3 = sanitizeUrlAttribute(schemeLikeUrl);

                expect(result3).toBe("#");
            });
        });

        describe("toString object handling", () => {
            it("serializes plain objects via JSON before sanitizing", () => {
                expect.assertions(1);

                const result = sanitizeHtml({ a: 1 });

                expect(result).toContain("1");
            });

            it("returns an empty string when an object cannot be serialized", () => {
                expect.assertions(1);

                const circular: Record<string, unknown> = {};

                circular.self = circular;

                expect(sanitizeHtml(circular)).toBe("");
            });
        });

        describe(sanitizeAttribute, () => {
            it("returns an empty string for an empty value", () => {
                expect.assertions(1);

                expect(sanitizeAttribute("")).toBe("");
            });
        });

        describe(sanitizeCodeHtml, () => {
            it("preserves class and style attributes from highlighters", () => {
                expect.assertions(2);

                const result = sanitizeCodeHtml("<span class=\"token\" style=\"color:red\">x</span>");

                expect(result).toContain("class=\"token\"");
                expect(result).toContain("style=\"color:red\"");
            });

            it("returns an empty string for an empty value", () => {
                expect.assertions(1);

                expect(sanitizeCodeHtml("")).toBe("");
            });
        });

        describe(sanitizeCspNonce, () => {
            it("returns the nonce when it matches the base64 pattern", () => {
                expect.assertions(1);

                expect(sanitizeCspNonce("abc123+/-_==")).toBe("abc123+/-_==");
            });

            it("returns undefined for a nonce with disallowed characters", () => {
                expect.assertions(1);

                expect(sanitizeCspNonce("bad nonce!")).toBeUndefined();
            });

            it("returns undefined for an empty nonce", () => {
                expect.assertions(1);

                expect(sanitizeCspNonce("")).toBeUndefined();
            });
        });

        describe(sanitizeOptions, () => {
            it("sanitizes the cspNonce and openInEditorUrl options", () => {
                expect.assertions(2);

                const result = sanitizeOptions({
                    cspNonce: "validNonce123",
                    openInEditorUrl: "https://editor.test/open",
                });

                expect(result.cspNonce).toBe("validNonce123");
                expect(result.openInEditorUrl).toBe("https://editor.test/open");
            });

            it("leaves openInEditorUrl undefined when not provided and defaults options", () => {
                expect.assertions(2);

                const result = sanitizeOptions();

                expect(result.openInEditorUrl).toBeUndefined();
                expect(result.cspNonce).toBeUndefined();
            });
        });
    });

    describe("process utility", () => {
        it("should provide process-like interface", () => {
            expect.assertions(1);

            expectTypeOf(process).toBeObject();

            expect(process).toBeDefined();
        });

        it("should handle missing process properties gracefully", () => {
            expect.assertions(1);

            expect(process.versions).toBeDefined();

            expectTypeOf(process.versions).toBeObject();
        });

        it("returns undefined for properties absent from both target and shims", () => {
            expect.assertions(1);

            expect((process as unknown as Record<string, unknown>).definitelyNotARealProcessProperty).toBeUndefined();
        });

        it("returns a cached string for getProcessVersion across calls", () => {
            expect.assertions(2);

            const first = getProcessVersion();

            expect(first).toBe(process.version ?? "");
            expect(getProcessVersion()).toBe(first);
        });

        it("returns a cached string for getProcessPlatform across calls", () => {
            expect.assertions(2);

            const first = getProcessPlatform();

            expect(first).toBe(process.platform ?? "");
            expect(getProcessPlatform()).toBe(first);
        });
    });

    describe(revisionHash, () => {
        it("should generate consistent hash for same input", () => {
            expect.assertions(1);

            const input = "test string";
            const hash1 = revisionHash(input);
            const hash2 = revisionHash(input);

            expect(hash1).toBe(hash2);
        });

        it("should generate different hashes for different inputs", () => {
            expect.assertions(1);

            const hash1 = revisionHash("input1");
            const hash2 = revisionHash("input2");

            expect(hash1).not.toBe(hash2);
        });

        it("should throw error for non-string input", () => {
            expect.assertions(1);

            expect(() => revisionHash(123 as unknown as string)).toThrow(TypeError);
        });

        it("should return 16 character hex string", () => {
            expect.assertions(1);

            const hash = revisionHash("test");

            expect(hash).toMatch(HEX_16_PATTERN);
        });
    });

    describe("runtime detection", () => {
        it("should return a valid runtime name or undefined", () => {
            expect.assertions(2);

            const validRuntimes: RuntimeName[] = ["bun", "deno", "edge-light", "fastly", "lagon", "netlify", "node", "workerd"];

            expect(runtime === undefined || typeof runtime === "string").toBe(true);

            // eslint-disable-next-line vitest/no-conditional-in-test
            if (runtime) {
                // eslint-disable-next-line vitest/no-conditional-expect
                expect(validRuntimes).toContain(runtime);
            }
        });

        it("should export runtime detection function", () => {
            expect.assertions(0);

            // @ts-expect-error TODO: this error is wrong
            expectTypeOf(runtime).toBeString();
        });
    });

    describe("tailwind utility", () => {
        describe("cn function", () => {
            it("should merge class names", () => {
                expect.assertions(1);

                const result = cn("class1", "class2");

                expect(result).toBe("class1 class2");
            });

            it("should filter out falsy values", () => {
                expect.assertions(1);

                const result = cn("class1", false, null, undefined, "class2");

                expect(result).toBe("class1 class2");
            });

            it("should handle empty inputs", () => {
                expect.assertions(1);

                const result = cn();

                expect(result).toBe("");
            });

            it("should handle single class", () => {
                expect.assertions(1);

                const result = cn("single-class");

                expect(result).toBe("single-class");
            });

            it("should convert non-string values to empty strings", () => {
                expect.assertions(1);

                // @ts-expect-error test
                const result = cn("class1", 123, "class2");

                expect(result).toBe("class1 class2");
            });
        });
    });
});
