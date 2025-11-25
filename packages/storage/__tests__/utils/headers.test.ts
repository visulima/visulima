import { describe, expect, it } from "vitest";

import { HeaderUtilities } from "../../src/utils/headers";

describe("headers", () => {
    describe(HeaderUtilities, () => {
        describe("acceptsMediaType", () => {
            it("should return true when media type is accepted", () => {
                expect.assertions(1);

                const result = HeaderUtilities.acceptsMediaType("application/json", "application/json");

                expect(result).toBe(true);
            });

            it("should return false when media type is not accepted", () => {
                expect.assertions(1);

                const result = HeaderUtilities.acceptsMediaType("application/json", "text/html");

                expect(result).toBe(false);
            });

            it("should return false when accept header is undefined", () => {
                expect.assertions(1);

                const result = HeaderUtilities.acceptsMediaType(undefined, "application/json");

                expect(result).toBe(false);
            });

            it("should handle wildcard accept header", () => {
                expect.assertions(1);

                const result = HeaderUtilities.acceptsMediaType("*/*", "application/json");

                expect(result).toBe(true);
            });
        });

        describe("createCacheControl", () => {
            it("should create cache control with public directive", () => {
                expect.assertions(1);

                const result = HeaderUtilities.createCacheControl({ public: true });

                expect(result).toBe("public");
            });

            it("should create cache control with private directive", () => {
                expect.assertions(1);

                const result = HeaderUtilities.createCacheControl({ private: true });

                expect(result).toBe("private");
            });

            it("should create cache control with no-cache directive", () => {
                expect.assertions(1);

                const result = HeaderUtilities.createCacheControl({ noCache: true });

                expect(result).toBe("no-cache");
            });

            it("should create cache control with no-store directive", () => {
                expect.assertions(1);

                const result = HeaderUtilities.createCacheControl({ noStore: true });

                expect(result).toBe("no-store");
            });

            it("should create cache control with immutable directive", () => {
                expect.assertions(1);

                const result = HeaderUtilities.createCacheControl({ immutable: true });

                expect(result).toBe("immutable");
            });

            it("should create cache control with max-age", () => {
                expect.assertions(1);

                const result = HeaderUtilities.createCacheControl({ maxAge: 3600 });

                expect(result).toBe("max-age=3600");
            });

            it("should create cache control with multiple directives", () => {
                expect.assertions(1);

                const result = HeaderUtilities.createCacheControl({
                    maxAge: 3600,
                    public: true,
                });

                expect(result).toBe("public, max-age=3600");
            });

            it("should create cache control with all options", () => {
                expect.assertions(9);

                const result = HeaderUtilities.createCacheControl({
                    immutable: true,
                    maxAge: 3600,
                    minFresh: 60,
                    mustRevalidate: true,
                    proxyRevalidate: true,
                    public: true,
                    sMaxAge: 7200,
                    staleIfError: 300,
                    staleWhileRevalidate: 120,
                });

                expect(result).toContain("public");
                expect(result).toContain("immutable");
                expect(result).toContain("must-revalidate");
                expect(result).toContain("proxy-revalidate");
                expect(result).toContain("max-age=3600");
                expect(result).toContain("s-maxage=7200");
                expect(result).toContain("min-fresh=60");
                expect(result).toContain("stale-while-revalidate=120");
                expect(result).toContain("stale-if-error=300");
            });

            it("should return empty string for no options", () => {
                expect.assertions(1);

                const result = HeaderUtilities.createCacheControl({});

                expect(result).toBe("");
            });
        });

        describe("createCacheControlPreset", () => {
            it("should create no-cache preset", () => {
                expect.assertions(1);

                const result = HeaderUtilities.createCacheControlPreset("no-cache");

                expect(result).toBe("no-cache");
            });

            it("should create no-store preset", () => {
                expect.assertions(1);

                const result = HeaderUtilities.createCacheControlPreset("no-store");

                expect(result).toBe("no-store");
            });

            it("should create public preset", () => {
                expect.assertions(2);

                const result = HeaderUtilities.createCacheControlPreset("public");

                expect(result).toContain("public");
                expect(result).toContain("max-age=3600");
            });

            it("should create private preset", () => {
                expect.assertions(2);

                const result = HeaderUtilities.createCacheControlPreset("private");

                expect(result).toContain("private");
                expect(result).toContain("max-age=3600");
            });

            it("should create immutable preset", () => {
                expect.assertions(2);

                const result = HeaderUtilities.createCacheControlPreset("immutable");

                expect(result).toContain("immutable");
                expect(result).toContain("max-age=31536000");
            });
        });

        describe("createContentDisposition", () => {
            it("should create attachment disposition", () => {
                expect.assertions(2);

                const result = HeaderUtilities.createContentDisposition({
                    filename: "test.txt",
                    type: "attachment",
                });

                expect(result).toContain("attachment");
                expect(result).toContain("filename");
            });

            it("should create inline disposition", () => {
                expect.assertions(1);

                const result = HeaderUtilities.createContentDisposition({
                    filename: "test.txt",
                    type: "inline",
                });

                expect(result).toContain("inline");
            });

            it("should create disposition with filenameSplat", () => {
                expect.assertions(1);

                const result = HeaderUtilities.createContentDisposition({
                    filenameSplat: "test.txt",
                    type: "attachment",
                });

                expect(result).toContain("attachment");
            });
        });

        describe("createContentType", () => {
            it("should create content type with media type", () => {
                expect.assertions(1);

                const result = HeaderUtilities.createContentType({
                    mediaType: "application/json",
                });

                expect(result).toBe("application/json");
            });

            it("should create content type with charset", () => {
                expect.assertions(2);

                const result = HeaderUtilities.createContentType({
                    charset: "utf8",
                    mediaType: "application/json",
                });

                expect(result).toContain("application/json");
                expect(result).toContain("charset=utf8");
            });

            it("should create content type with boundary", () => {
                expect.assertions(2);

                const result = HeaderUtilities.createContentType({
                    boundary: "----WebKitFormBoundary",
                    mediaType: "multipart/form-data",
                });

                expect(result).toContain("multipart/form-data");
                expect(result).toContain("boundary");
            });
        });

        describe("ensureCharset", () => {
            it("should add charset if missing", () => {
                expect.assertions(1);

                const result = HeaderUtilities.ensureCharset("application/json");

                expect(result).toContain("charset");
            });

            it("should not add charset if already present", () => {
                expect.assertions(1);

                const result = HeaderUtilities.ensureCharset("application/json; charset=utf8");

                expect(result).toContain("charset=utf8");
            });

            it("should use default charset", () => {
                expect.assertions(1);

                const result = HeaderUtilities.ensureCharset("application/json", "iso-8859-1");

                expect(result).toContain("charset=iso-8859-1");
            });
        });

        describe("fromHeaders", () => {
            it("should convert array headers", () => {
                expect.assertions(2);

                const headers = [
                    ["Content-Type", "application/json"],
                    ["Authorization", "Bearer token"],
                ];

                const result = HeaderUtilities.fromHeaders(headers);

                expect(result.get("Content-Type")).toBe("application/json");
                expect(result.get("Authorization")).toBe("Bearer token");
            });

            it("should convert object headers", () => {
                expect.assertions(2);

                const headers = {
                    Authorization: "Bearer token",
                    "Content-Type": "application/json",
                };

                const result = HeaderUtilities.fromHeaders(headers);

                expect(result.get("Content-Type")).toBe("application/json");
                expect(result.get("Authorization")).toBe("Bearer token");
            });

            it("should handle array values in headers", () => {
                expect.assertions(1);

                const headers = {
                    "Set-Cookie": ["cookie1", "cookie2"],
                };

                const result = HeaderUtilities.fromHeaders(headers);

                expect(result.get("Set-Cookie")).toBe("cookie1, cookie2");
            });
        });

        describe("getPreferredMediaType", () => {
            it("should return preferred media type from accept header", () => {
                expect.assertions(1);

                const result = HeaderUtilities.getPreferredMediaType("application/json, text/html", [
                    "application/json",
                    "text/html",
                ]);

                expect(result).toBe("application/json");
            });

            it("should return undefined when no match", () => {
                expect.assertions(1);

                const result = HeaderUtilities.getPreferredMediaType("application/json", ["text/html"]);

                expect(result).toBeUndefined();
            });

            it("should return undefined when accept header is undefined", () => {
                expect.assertions(1);

                const result = HeaderUtilities.getPreferredMediaType(undefined, ["application/json"]);

                expect(result).toBeUndefined();
            });
        });

        describe("parseAccept", () => {
            it("should parse valid accept header", () => {
                expect.assertions(1);

                const result = HeaderUtilities.parseAccept("application/json");

                expect(result).toBeDefined();
            });

            it("should return undefined for undefined header", () => {
                expect.assertions(1);

                const result = HeaderUtilities.parseAccept(undefined);

                expect(result).toBeUndefined();
            });
        });

        describe("parseContentDisposition", () => {
            it("should parse valid content disposition header", () => {
                expect.assertions(1);

                const result = HeaderUtilities.parseContentDisposition("attachment; filename=\"test.txt\"");

                expect(result).toBeDefined();
            });

            it("should return undefined for undefined header", () => {
                expect.assertions(1);

                const result = HeaderUtilities.parseContentDisposition(undefined);

                expect(result).toBeUndefined();
            });
        });

        describe("parseContentType", () => {
            it("should parse valid content type header", () => {
                expect.assertions(1);

                const result = HeaderUtilities.parseContentType("application/json; charset=utf8");

                expect(result).toBeDefined();
            });

            it("should return undefined for undefined header", () => {
                expect.assertions(1);

                const result = HeaderUtilities.parseContentType(undefined);

                expect(result).toBeUndefined();
            });
        });
    });
});
