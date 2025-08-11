import { describe, expect, it } from "vitest";

import ruleBasedFinder from "../src/solution/rule-based-finder";

const dummyFile = {
    file: "/project/src/file.ts",
    language: "ts",
    line: 10,
    snippet: "export const x = 1;",
};

async function run(message: string) {
    const err = new Error(message);
    return ruleBasedFinder.handle(err, dummyFile);
}

describe("rule-based-finder", () => {
    it("detects ESM/CJS interop issues", async () => {
        const res = await run("Error [ERR_REQUIRE_ESM]: Must use import to load ES Module");
        expect(res).toBeTruthy();
        expect(res?.header).toContain("Potential fixes");
        expect(res?.body).toContain("ESM/CJS interop");
        expect(res?.body).toContain("dynamic");
    });

    it("detects default export mismatch", async () => {
        const res = await run("Attempted import error: default export not found");
        expect(res?.body).toContain("Export mismatch");
        expect(res?.body).toContain("Default export example");
    });

    it("detects port in use", async () => {
        const res = await run("listen EADDRINUSE: address already in use 3000");
        expect(res?.body).toContain("Port already in use");
        expect(res?.body).toContain("lsof -i");
    });

    it("detects missing file or path case mismatch", async () => {
        const res = await run("Cannot find module './Foo' imported from ./bar");
        expect(res?.body).toContain("Missing file or path case mismatch");
        expect(res?.body).toContain("Current file");
    });

    it("detects TS path mapping issues", async () => {
        const res = await run("TS2307: Cannot find module '@app/utils'");
        expect(res?.body).toContain("TypeScript path mapping");
        expect(res?.body).toContain("tsconfig.json excerpt");
    });

    it("detects network/DNS issues", async () => {
        const res = await run("getaddrinfo ENOTFOUND api.example.com");
        expect(res?.body).toContain("Network/DNS connection issue");
        expect(res?.body).toContain("ping <host>");
    });

    it("detects React hydration mismatch", async () => {
        const res = await run("Hydration failed because the initial UI does not match what was rendered on the server");
        expect(res?.body).toContain("React hydration mismatch");
        expect(res?.body).toContain("Checklist");
    });

    it("detects undefined property access", async () => {
        const res = await run("TypeError: Cannot read properties of undefined (reading 'foo')");
        expect(res?.body).toContain("Accessing property of undefined");
        expect(res?.body).toContain("nullish");
    });
});


