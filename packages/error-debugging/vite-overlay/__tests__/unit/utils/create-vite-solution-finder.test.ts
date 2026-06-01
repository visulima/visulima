import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, expectTypeOf, it } from "vitest";

import createViteSolutionFinder from "../../../src/utils/create-vite-solution-finder";

const temporaryRoot = mkdtempSync(join(tmpdir(), "vite-solution-finder-"));

beforeAll(() => {
    mkdirSync(join(temporaryRoot, "src", "components"), { recursive: true });
    mkdirSync(join(temporaryRoot, "public"), { recursive: true });
    writeFileSync(join(temporaryRoot, "src", "App.tsx"), "export const App = () => null;");
    writeFileSync(join(temporaryRoot, "src", "components", "Button.tsx"), "export const Button = () => null;");
    writeFileSync(join(temporaryRoot, "src", "components", "Buton.tsx"), "// typo neighbour"); // for fuzzy match
    writeFileSync(join(temporaryRoot, "src", "utils.ts"), "export const x = 1;");
    writeFileSync(join(temporaryRoot, "public", "logo.svg"), "<svg />");
});

afterAll(() => {
    // Cleanup is best-effort — temp dir will be reclaimed by the OS.
});

const context = (overrides: Partial<{ file: string; language: string; line: number; snippet: string }> = {}) => {
    return {
        file: overrides.file ?? "",
        language: overrides.language ?? "",
        line: overrides.line ?? 0,
        snippet: overrides.snippet ?? "",
    };
};

describe(createViteSolutionFinder, () => {
    it("returns a SolutionFinder with the expected name and priority", () => {
        expect.assertions(2);

        const finder = createViteSolutionFinder(temporaryRoot);

        expect(finder.name).toBe("vite-solution-finder");
        expect(finder.priority).toBe(20);

        expectTypeOf(finder.handle).toBeFunction();
    });

    it("returns undefined when the error message matches no pattern", async () => {
        expect.assertions(1);

        const finder = createViteSolutionFinder(temporaryRoot);
        const error = new Error("something completely unrelated");

        const solution = await finder.handle(error, context());

        expect(solution).toBeUndefined();
    });

    it("suggests similar files for failed imports inside the project root", async () => {
        expect.assertions(1);

        const finder = createViteSolutionFinder(temporaryRoot);
        const error = new Error("Failed to resolve import \"./components/Buton\" from \"src/App.tsx\"");
        const solution = await finder.handle(error, context({ file: join(temporaryRoot, "src", "App.tsx"), language: "typescript" }));

        expect(solution?.body ?? "").toContain("Did you mean");
    });

    it("returns a 'File Not Found' hint when a relative import has fuzzy matches", async () => {
        expect.assertions(2);

        const finder = createViteSolutionFinder(temporaryRoot);
        // 'Buton' has a near-neighbour `Button.tsx` in the temp root.
        const error = new Error("Cannot resolve \"./components/Buton\"");
        const solution = await finder.handle(error, context({ file: join(temporaryRoot, "src", "App.ts"), language: "typescript" }));

        expect(solution?.header).toBe("File Not Found");
        expect(solution?.body ?? "").toContain("Did you mean");
    });

    it("returns a 'Missing File Extension' hint when the import has no source file context", async () => {
        expect.assertions(2);

        const finder = createViteSolutionFinder(temporaryRoot);
        // No `file` in the context -> the suggestions branch is skipped and we fall through
        // to the "Missing File Extension" hint.
        const error = new Error("Cannot resolve \"./xx_nonexistent_qzv\"");
        const solution = await finder.handle(error, context({ language: "typescript" }));

        expect(solution?.header).toBe("Missing File Extension");
        expect(solution?.body).toContain("`.js` extension");
    });

    it("matches built-in pattern hints (window/document SSR)", async () => {
        expect.assertions(2);

        const finder = createViteSolutionFinder(temporaryRoot);
        const error = new Error("ReferenceError: window is not defined during ssr");
        const solution = await finder.handle(error, context());

        expect(solution?.header).toBe("SSR Browser API Error");
        expect(solution?.body).toContain("browser APIs");
    });

    it("matches hydration mismatch pattern", async () => {
        expect.assertions(2);

        const finder = createViteSolutionFinder(temporaryRoot);
        const error = new Error(
            "Hydration failed because the initial UI does not match what was rendered on the server. Text content does not match server html.",
        );
        const solution = await finder.handle(error, context());

        expect(solution).toBeDefined();
        expect(solution?.body).toContain("Checklist");
    });

    it("matches the environment-variables pattern (VITE_ / process.env)", async () => {
        expect.assertions(2);

        const finder = createViteSolutionFinder(temporaryRoot);
        const error = new Error("Use VITE_ prefix for client variables, process.env was undefined");
        const solution = await finder.handle(error, context());

        expect(solution?.header).toBe("Environment Variables");
        expect(solution?.body).toContain("VITE_");
    });

    it("matches the asset import pattern", async () => {
        expect.assertions(2);

        const finder = createViteSolutionFinder(temporaryRoot);
        const error = new Error("Failed to load /assets/logo.png");
        const solution = await finder.handle(error, context());

        expect(solution?.header).toBe("Asset Import Issue");
        expect(solution?.body).toContain("import.meta.url");
    });

    it("matches TypeScript configuration when file ends with .ts", async () => {
        expect.assertions(1);

        const finder = createViteSolutionFinder(temporaryRoot);
        const error = new Error("Random message");
        const solution = await finder.handle(error, context({ file: join(temporaryRoot, "src", "utils.ts") }));

        expect(solution?.header).toBe("TypeScript Configuration");
    });

    it("handles an error with no message by returning undefined", async () => {
        expect.assertions(1);

        const finder = createViteSolutionFinder(temporaryRoot);
        const error = { message: undefined };
        const solution = await finder.handle(error, context());

        expect(solution).toBeUndefined();
    });

    it("suggests an absolute public-folder URL when a matching asset lives under public/", async () => {
        expect.assertions(2);

        const finder = createViteSolutionFinder(temporaryRoot);
        // `logo.svg` exists under <root>/public, so the match is in the public folder and is an asset.
        const error = new Error("Failed to resolve import \"./logo.svg\" from \"src/App.tsx\"");
        const solution = await finder.handle(error, context({ file: join(temporaryRoot, "src", "App.tsx"), language: "typescript" }));

        expect(solution?.body ?? "").toContain("Did you mean");
        expect(solution?.body ?? "").toContain("`public` folder");
    });

    it("includes a parent-directory hint when the suggestion sits one level up", async () => {
        expect.assertions(1);

        const finder = createViteSolutionFinder(temporaryRoot);
        // Importing from a nested file so a match in `src` is in the parent directory.
        const error = new Error("Failed to resolve import \"./utils\" from \"src/components/Button.tsx\"");
        const solution = await finder.handle(error, context({ file: join(temporaryRoot, "src", "components", "Button.tsx"), language: "typescript" }));

        // utils.ts lives in src/, one directory above src/components -> parent directory hint.
        expect(solution?.body ?? "").toContain("parent directory");
    });

    it("matches the build-vs-development pattern", async () => {
        expect.assertions(1);

        const finder = createViteSolutionFinder(temporaryRoot);
        const error = new Error("This only happens in a production build");
        const solution = await finder.handle(error, context());

        expect(solution?.header).toBe("Build vs Development Mode");
    });

    it("matches the HMR pattern", async () => {
        expect.assertions(1);

        const finder = createViteSolutionFinder(temporaryRoot);
        const error = new Error("HMR update could not be applied");
        const solution = await finder.handle(error, context());

        expect(solution?.header).toBe("Hot Module Replacement Issue");
    });

    it("matches the path-resolution pattern", async () => {
        expect.assertions(1);

        const finder = createViteSolutionFinder(temporaryRoot);
        const error = new Error("Cannot find module '@/foo'");
        const solution = await finder.handle(error, context());

        expect(solution?.header).toBe("Path Resolution");
    });
});
