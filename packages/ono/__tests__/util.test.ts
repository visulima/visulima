import { describe, expect, it } from "vitest";

import { sanitizeAttr, sanitizeHtml, sanitizeUrlAttr } from "../src/error-inspector/util/sanitize";
import process from "../src/util/process";
import revisionHash from "../src/util/revision-hash";
import runtime, { type RuntimeName } from "../src/util/runtimes";
import { cn } from "../src/error-inspector/util/tw";

describe("utilities", () => {
    describe("sanitize functions", () => {
        describe("sanitizeHtml", () => {
            it("should sanitize HTML content", () => {
                const input = '<script>alert("xss")</script><p>Hello</p>';
                const result = sanitizeHtml(input);
                expect(result).toBe('<p>Hello</p>');
                expect(result).not.toContain('<script>');
            });

            it("should handle undefined input", () => {
                const result = sanitizeHtml(undefined);
                expect(result).toBe('');
            });

            it("should handle null input", () => {
                const result = sanitizeHtml(null);
                expect(result).toBe('');
            });

            it("should convert non-string input to string", () => {
                const result = sanitizeHtml(123);
                expect(result).toBe('123');
            });
        });

        describe("sanitizeAttr", () => {
            it("should sanitize attribute values", () => {
                const input = '"onload=alert(1)"';
                const result = sanitizeAttr(input);
                expect(result).toContain('&quot;');
                expect(result).toContain('onload');
            });

            it("should escape special characters", () => {
                const input = '<>"\'&';
                const result = sanitizeAttr(input);
                // DOMPurify might already escape some characters, so we check that dangerous chars are escaped
                expect(result).not.toContain('<');
                expect(result).not.toContain('>');
                expect(result).not.toContain('"');
                expect(result).not.toContain("'");
                expect(result).toContain('&');
            });
        });

        describe("sanitizeUrlAttr", () => {
            it("should sanitize URL attributes", () => {
                const input = 'javascript:alert(1)';
                const result = sanitizeUrlAttr(input);
                expect(result).toBe('#');
            });

            it("should allow safe URLs", () => {
                const input = 'https://example.com/path';
                const result = sanitizeUrlAttr(input);
                expect(result).toBe('https://example.com/path');
            });

            it("should allow relative URLs", () => {
                const input = '/path/to/file';
                const result = sanitizeUrlAttr(input);
                expect(result).toBe('/path/to/file');
            });
        });
    });

    describe("process utility", () => {
        it("should provide process-like interface", () => {
            expect(typeof process).toBe('object');
        });

        it("should handle missing process properties gracefully", () => {
            expect(process.versions).toBeDefined();
            expect(typeof process.versions).toBe('object');
        });
    });

    describe("revisionHash", () => {
        it("should generate consistent hash for same input", () => {
            const input = "test string";
            const hash1 = revisionHash(input);
            const hash2 = revisionHash(input);
            expect(hash1).toBe(hash2);
        });

        it("should generate different hashes for different inputs", () => {
            const hash1 = revisionHash("input1");
            const hash2 = revisionHash("input2");
            expect(hash1).not.toBe(hash2);
        });

        it("should throw error for non-string input", () => {
            expect(() => revisionHash(123 as any)).toThrow(TypeError);
        });

        it("should return 16 character hex string", () => {
            const hash = revisionHash("test");
            expect(hash).toMatch(/^[a-f0-9]{16}$/);
        });
    });

    describe("runtime detection", () => {
        it("should return a valid runtime name or undefined", () => {
            const validRuntimes: RuntimeName[] = [
                "bun", "deno", "edge-light", "fastly", "lagon", "netlify", "node", "workerd"
            ];

            expect(typeof runtime === "string" || runtime === undefined).toBe(true);

            if (runtime) {
                expect(validRuntimes).toContain(runtime);
            }
        });

        it("should export runtime detection function", () => {
            expect(typeof runtime).toBe("string");
        });
    });

    describe("tailwind utility", () => {
        describe("cn function", () => {
            it("should merge class names", () => {
                const result = cn("class1", "class2");
                expect(result).toBe("class1 class2");
            });

            it("should filter out falsy values", () => {
                const result = cn("class1", false, null, undefined, "class2");
                expect(result).toBe("class1 class2");
            });

            it("should handle empty inputs", () => {
                const result = cn();
                expect(result).toBe("");
            });

            it("should handle single class", () => {
                const result = cn("single-class");
                expect(result).toBe("single-class");
            });

            it("should convert non-string values to empty strings", () => {
                const result = cn("class1", 123, "class2");
                expect(result).toBe("class1 class2");
            });
        });
    });
});
