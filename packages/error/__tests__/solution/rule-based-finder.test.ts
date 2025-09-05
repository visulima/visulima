import { describe, expect, it } from "vitest";

import ruleBasedFinder from "../../src/solution/rule-based-finder";

describe("solution/rule-based-finder", () => {
    it("should detect ESM/CJS interop issue", async () => {
        expect.assertions(2);

        const error = new Error("ERR_REQUIRE_ESM: Must use import to load ES Module");
        const result = await ruleBasedFinder.handle(error, { file: "index.js", line: 1 });

        expect(result?.header).toBe("### Potential fixes detected");
        expect(result?.body).toContain("ESM/CJS interop");
    });

    it("should detect missing default export", async () => {
        expect.assertions(1);

        const error = new Error("Module has no default export");
        const result = await ruleBasedFinder.handle(error, { file: "comp.ts", line: 10 });

        expect(result?.body).toContain("Export mismatch");
    });

    it("should detect port in use", async () => {
        expect.assertions(1);

        const error = new Error("listen EADDRINUSE: address already in use :::3000");
        const result = await ruleBasedFinder.handle(error, { file: "server.ts", line: 1 });

        expect(result?.body).toContain("Port already in use");
    });

    it("should detect file not found", async () => {
        expect.assertions(1);

        const error = new Error("Cannot find module './x'");
        const result = await ruleBasedFinder.handle(error, { file: "app.ts", line: 2 });

        expect(result?.body).toContain("Missing file or path case mismatch");
    });

    it("should detect TS path mapping error", async () => {
        expect.assertions(1);

        const error = new Error("TS2307: Cannot find module '@/'");
        const result = await ruleBasedFinder.handle(error, { file: "app.ts", line: 2 });

        expect(result?.body).toContain("TypeScript path mapping");
    });

    it("should detect network/dns error", async () => {
        expect.assertions(1);

        const error = new Error("getaddrinfo ENOTFOUND foo.example");
        const result = await ruleBasedFinder.handle(error, { file: "fetch.ts", line: 2 });

        expect(result?.body).toContain("Network/DNS connection issue");
    });

    it("should detect react hydration mismatch", async () => {
        expect.assertions(1);

        const error = new Error("Hydration failed because the initial UI does not match");
        const result = await ruleBasedFinder.handle(error, { file: "page.tsx", line: 2 });

        expect(result?.body).toContain("React hydration mismatch");
    });

    it("should detect undefined property access", async () => {
        expect.assertions(1);

        const error = new Error("Cannot read properties of undefined (reading 'x')");
        const result = await ruleBasedFinder.handle(error, { file: "lib.ts", line: 2 });

        expect(result?.body).toContain("Accessing property of undefined");
    });
});
