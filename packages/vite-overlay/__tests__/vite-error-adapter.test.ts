import { describe, expect, it } from "vitest";
import type { ViteDevServer } from "vite";

import { extractLocationFromViteError, extractViteErrorLocation } from "../src/utils/vite-error-adapter";

describe(extractLocationFromViteError, () => {
    const mockServer = {
        config: {
            root: "/home/user/project",
        },
    } as ViteDevServer;

    it("should extract location from Vite error with file:line:column format", () => {
        const message = 'Failed to resolve import "../vite.svg" from "src/App.tsx". Does the file exist?\n  File: /home/user/project/src/App.tsx:5:21';
        const result = extractLocationFromViteError(message, mockServer);

        expect(result).toEqual({
            file: "/home/user/project/src/App.tsx",
            line: 5,
            column: 21,
        });
    });

    it("should extract location from Vite error with file:line format", () => {
        const message = 'Syntax error in component\n  File: /home/user/project/src/Component.tsx:10';
        const result = extractLocationFromViteError(message, mockServer);

        expect(result).toEqual({
            file: "/home/user/project/src/Component.tsx",
            line: 10,
            column: 1, // Default column when not specified
        });
    });

    it("should handle absolute file paths", () => {
        const message = 'Error in module\n  File: /absolute/path/to/file.js:3:15';
        const result = extractLocationFromViteError(message, mockServer);

        expect(result).toEqual({
            file: "/absolute/path/to/file.js",
            line: 3,
            column: 15,
        });
    });

    it("should handle relative file paths", () => {
        const message = 'Import error\n  File: src/utils/helpers.ts:8:5';
        const result = extractLocationFromViteError(message, mockServer);

        expect(result).toEqual({
            file: "/home/user/project/src/utils/helpers.ts",
            line: 8,
            column: 5,
        });
    });

    it("should return null for messages without file location", () => {
        const message = "Some error without file location information";
        const result = extractLocationFromViteError(message, mockServer);

        expect(result).toBeNull();
    });

    it("should handle server without root config for relative paths", () => {
        const serverWithoutRoot = {
            config: {},
        } as ViteDevServer;

        const message = 'Error in file\n  File: src/main.ts:12:8';
        const result = extractLocationFromViteError(message, serverWithoutRoot);

        // Should use process.cwd() as fallback
        expect(result?.line).toBe(12);
        expect(result?.column).toBe(8);
        expect(result?.file).toContain("src/main.ts");
    });
});

describe(extractViteErrorLocation, () => {
    const mockServer = {
        config: {
            root: "/home/user/project",
        },
    } as ViteDevServer;

    it("should delegate to extractLocationFromViteError for Vite errors with file location", () => {
        const message = 'Failed to resolve import "../vite.svg" from "src/App.tsx". Does the file exist?\n  File: /home/user/project/src/App.tsx:5:21';
        const result = extractViteErrorLocation(message, mockServer);

        expect(result).toEqual({
            file: "/home/user/project/src/App.tsx",
            line: 5,
            column: 21,
        });
    });

    it("should return null for messages without file location", () => {
        const message = "Some other error without file location information";
        const result = extractViteErrorLocation(message, mockServer);

        expect(result).toBeNull();
    });
});
