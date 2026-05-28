/* eslint-disable @typescript-eslint/no-explicit-any */
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import createViteSolutionFinder from "../../../src/utils/create-vite-solution-finder";

const tempRoot = mkdtempSync(join(tmpdir(), "vite-solution-finder-"));

beforeAll(() => {
    mkdirSync(join(tempRoot, "src", "components"), { recursive: true });
    mkdirSync(join(tempRoot, "public"), { recursive: true });
    writeFileSync(join(tempRoot, "src", "App.tsx"), "export const App = () => null;");
    writeFileSync(join(tempRoot, "src", "components", "Button.tsx"), "export const Button = () => null;");
    writeFileSync(join(tempRoot, "src", "components", "Buton.tsx"), "// typo neighbour"); // for fuzzy match
    writeFileSync(join(tempRoot, "src", "utils.ts"), "export const x = 1;");
    writeFileSync(join(tempRoot, "public", "logo.svg"), "<svg />");
});

afterAll(() => {
    // Cleanup is best-effort — temp dir will be reclaimed by the OS.
});

const context = (overrides: Partial<{ file: string; language: string; line: number; snippet: string }> = {}) => ({
    file: overrides.file ?? "",
    language: overrides.language ?? "",
    line: overrides.line ?? 0,
    snippet: overrides.snippet ?? "",
});

describe(createViteSolutionFinder, () => {
    it("returns a SolutionFinder with the expected name and priority", () => {
        expect.assertions(3);

        const finder = createViteSolutionFinder(tempRoot);

        expect(finder.name).toBe("vite-solution-finder");
        expect(finder.priority).toBe(20);
        expect(typeof finder.handle).toBe("function");
    });

    it("returns undefined when the error message matches no pattern", async () => {
        expect.assertions(1);

        const finder = createViteSolutionFinder(tempRoot);
        const error = new Error("something completely unrelated") as any;

        const solution = await finder.handle!(error, context() as any);

        expect(solution).toBeUndefined();
    });

    it("suggests similar files for failed imports inside the project root", async () => {
        expect.assertions(1);

        const finder = createViteSolutionFinder(tempRoot);
        const error = new Error("Failed to resolve import \"./components/Buton\" from \"src/App.tsx\"") as any;
        const solution = await finder.handle!(error, context({ file: join(tempRoot, "src", "App.tsx"), language: "typescript" }) as any);

        expect(solution?.body || "").toContain("Did you mean");
    });

    it("returns a 'File Not Found' hint when a relative import has fuzzy matches", async () => {
        expect.assertions(2);

        const finder = createViteSolutionFinder(tempRoot);
        // 'Buton' has a near-neighbour `Button.tsx` in the temp root.
        const error = new Error("Cannot resolve \"./components/Buton\"") as any;
        const solution = await finder.handle!(error, context({ file: join(tempRoot, "src", "App.ts"), language: "typescript" }) as any);

        expect(solution?.header).toBe("File Not Found");
        expect(solution?.body || "").toContain("Did you mean");
    });

    it("returns a 'Missing File Extension' hint when the import has no source file context", async () => {
        expect.assertions(2);

        const finder = createViteSolutionFinder(tempRoot);
        // No `file` in the context -> the suggestions branch is skipped and we fall through
        // to the "Missing File Extension" hint.
        const error = new Error("Cannot resolve \"./xx_nonexistent_qzv\"") as any;
        const solution = await finder.handle!(error, context({ language: "typescript" }) as any);

        expect(solution?.header).toBe("Missing File Extension");
        expect(solution?.body).toContain("`.js` extension");
    });

    it("matches built-in pattern hints (window/document SSR)", async () => {
        expect.assertions(2);

        const finder = createViteSolutionFinder(tempRoot);
        const error = new Error("ReferenceError: window is not defined during ssr") as any;
        const solution = await finder.handle!(error, context() as any);

        expect(solution?.header).toBe("SSR Browser API Error");
        expect(solution?.body).toContain("browser APIs");
    });

    it("matches hydration mismatch pattern", async () => {
        expect.assertions(2);

        const finder = createViteSolutionFinder(tempRoot);
        const error = new Error("Hydration failed because the initial UI does not match what was rendered on the server. Text content does not match server html.") as any;
        const solution = await finder.handle!(error, context() as any);

        expect(solution).toBeDefined();
        expect(solution?.body).toContain("Checklist");
    });

    it("matches the environment-variables pattern (VITE_ / process.env)", async () => {
        expect.assertions(2);

        const finder = createViteSolutionFinder(tempRoot);
        const error = new Error("Use VITE_ prefix for client variables, process.env was undefined") as any;
        const solution = await finder.handle!(error, context() as any);

        expect(solution?.header).toBe("Environment Variables");
        expect(solution?.body).toContain("VITE_");
    });

    it("matches the asset import pattern", async () => {
        expect.assertions(2);

        const finder = createViteSolutionFinder(tempRoot);
        const error = new Error("Failed to load /assets/logo.png") as any;
        const solution = await finder.handle!(error, context() as any);

        expect(solution?.header).toBe("Asset Import Issue");
        expect(solution?.body).toContain("import.meta.url");
    });

    it("matches TypeScript configuration when file ends with .ts", async () => {
        expect.assertions(1);

        const finder = createViteSolutionFinder(tempRoot);
        const error = new Error("Random message") as any;
        const solution = await finder.handle!(error, context({ file: join(tempRoot, "src", "utils.ts") }) as any);

        expect(solution?.header).toBe("TypeScript Configuration");
    });
});
