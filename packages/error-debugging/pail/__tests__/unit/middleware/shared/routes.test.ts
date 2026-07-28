import { describe, expect, it } from "vitest";

import { getServiceForPath, matchesPattern, shouldLog } from "../../../../src/middleware/shared/routes";

describe("routes", () => {
    describe(matchesPattern, () => {
        it("should match exact paths", () => {
            expect.assertions(2);

            expect(matchesPattern("/api/users", "/api/users")).toBe(true);
            expect(matchesPattern("/api/users", "/api/posts")).toBe(false);
        });

        it("should match single wildcard (*) within a segment", () => {
            expect.assertions(3);

            expect(matchesPattern("/api/users", "/api/*")).toBe(true);
            expect(matchesPattern("/api/users/123", "/api/*")).toBe(false);
            // "/api/" matches "/api/*" because * matches zero or more non-slash chars
            expect(matchesPattern("/api/", "/api/*")).toBe(true);
        });

        it("should match double wildcard (**) across segments", () => {
            expect.assertions(4);

            expect(matchesPattern("/api/users", "/api/**")).toBe(true);
            expect(matchesPattern("/api/users/123", "/api/**")).toBe(true);
            expect(matchesPattern("/api/users/123/posts", "/api/**")).toBe(true);
            expect(matchesPattern("/other", "/api/**")).toBe(false);
        });

        it("should match question mark (?) for single character", () => {
            expect.assertions(2);

            expect(matchesPattern("/api/v1", "/api/v?")).toBe(true);
            expect(matchesPattern("/api/v12", "/api/v?")).toBe(false);
        });

        it("should escape dots", () => {
            expect.assertions(2);

            expect(matchesPattern("/favicon.ico", "/favicon.ico")).toBe(true);
            expect(matchesPattern("/faviconXico", "/favicon.ico")).toBe(false);
        });

        it("should treat regex metacharacters as literals", () => {
            expect.assertions(7);

            // `+` would otherwise be a quantifier
            expect(matchesPattern("/api/c++/build", "/api/c++/**")).toBe(true);
            expect(matchesPattern("/api/c/build", "/api/c++/**")).toBe(false);
            // `(`/`)` are a live group and would throw without escaping
            expect(() => matchesPattern("/api/(v1)/users", "/api/(v1)/**")).not.toThrow();
            expect(matchesPattern("/api/(v1)/users", "/api/(v1)/**")).toBe(true);
            // `|` would otherwise alternate
            expect(matchesPattern("/a|b", "/a|b")).toBe(true);
            expect(matchesPattern("/a", "/a|b")).toBe(false);
            // `$` would otherwise anchor
            expect(matchesPattern("/price$", "/price$")).toBe(true);
        });

        it("should handle ** with trailing slash", () => {
            expect.assertions(2);

            expect(matchesPattern("/api/auth/login", "/api/auth/**")).toBe(true);
            expect(matchesPattern("/api/auth", "/api/auth/**")).toBe(true);
        });

        it("should handle ** in the middle of a pattern", () => {
            expect.assertions(3);

            expect(matchesPattern("/api/login", "/api/**/login")).toBe(true);
            expect(matchesPattern("/api/auth/v1/login", "/api/**/login")).toBe(true);
            expect(matchesPattern("/api/users", "/api/**/login")).toBe(false);
        });

        it("should handle ** at the end without a preceding slash", () => {
            expect.assertions(2);

            expect(matchesPattern("/apixyz", "/api**")).toBe(true);
            expect(matchesPattern("/other", "/api**")).toBe(false);
        });
    });

    describe(shouldLog, () => {
        it("should log all paths when no include/exclude", () => {
            expect.assertions(2);

            expect(shouldLog("/api/users")).toBe(true);
            expect(shouldLog("/health")).toBe(true);
        });

        it("should exclude matching paths", () => {
            expect.assertions(2);

            expect(shouldLog("/health", undefined, ["/health"])).toBe(false);
            expect(shouldLog("/api/users", undefined, ["/health"])).toBe(true);
        });

        it("should include only matching paths", () => {
            expect.assertions(2);

            expect(shouldLog("/api/users", ["/api/**"])).toBe(true);
            expect(shouldLog("/health", ["/api/**"])).toBe(false);
        });

        it("should give exclusions precedence over inclusions", () => {
            expect.assertions(2);

            expect(shouldLog("/api/internal", ["/api/**"], ["/api/internal"])).toBe(false);
            expect(shouldLog("/api/users", ["/api/**"], ["/api/internal"])).toBe(true);
        });

        it("should handle multiple exclude patterns", () => {
            expect.assertions(3);

            const exclude = ["/health", "/_next/**", "/favicon.ico"];

            expect(shouldLog("/health", undefined, exclude)).toBe(false);
            expect(shouldLog("/_next/static/chunk.js", undefined, exclude)).toBe(false);
            expect(shouldLog("/api/users", undefined, exclude)).toBe(true);
        });

        it("should handle empty arrays", () => {
            expect.assertions(2);

            expect(shouldLog("/api/users", [], [])).toBe(true);
            expect(shouldLog("/anything", [], [])).toBe(true);
        });
    });

    describe(getServiceForPath, () => {
        it("should return undefined when no routes configured", () => {
            expect.assertions(1);

            expect(getServiceForPath("/api/users")).toBeUndefined();
        });

        it("should return undefined when no route matches", () => {
            expect.assertions(1);

            const routes = { "/api/auth/**": { service: "auth-service" } };

            expect(getServiceForPath("/api/users", routes)).toBeUndefined();
        });

        it("should return service for matching route", () => {
            expect.assertions(1);

            const routes = { "/api/auth/**": { service: "auth-service" } };

            expect(getServiceForPath("/api/auth/login", routes)).toBe("auth-service");
        });

        it("should return first matching route", () => {
            expect.assertions(1);

            const routes = {
                "/api/auth/**": { service: "auth-service" },
                "/api/auth/admin/**": { service: "admin-service" },
            };

            expect(getServiceForPath("/api/auth/admin/users", routes)).toBe("auth-service");
        });

        it("should return undefined for route without service", () => {
            expect.assertions(1);

            const routes = { "/api/auth/**": {} };

            expect(getServiceForPath("/api/auth/login", routes)).toBeUndefined();
        });
    });
});
