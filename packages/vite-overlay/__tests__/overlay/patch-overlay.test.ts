import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { patchOverlay } from "../../src/overlay/patch-overlay";

// Mock the dependencies
vi.mock("../../../../../shared/utils/editors", () => {
    return {
        default: {
            vscode: "Visual Studio Code",
            webstorm: "WebStorm",
        },
    };
});

vi.mock("lucide-static/icons/moon-star.svg?data-uri&encoding=css", () => {
    return {
        default: "data:image/svg+xml;base64,mock-moon-icon",
    };
});

vi.mock("lucide-static/icons/sun.svg?data-uri&encoding=css", () => {
    return {
        default: "data:image/svg+xml;base64,mock-sun-icon",
    };
});

describe(patchOverlay, () => {
    it("should return modified code when overlay injection is needed", () => {
        expect.assertions(3);

        // patchOverlay expects Vite client code with ErrorOverlay class
        const inputCode = `
class ErrorOverlay {
    constructor(error) {
        this.error = error;
        this.root = document.createElement('div');
        document.body.append(this.root);
    }
}
`;

        const result = patchOverlay(inputCode);

        expect(result).toBeDefined();

        expectTypeOf(result).toBeString();

        expect(result).not.toBe(inputCode); // Should be modified
        expect(result).toContain("__v_o__overlay");
    });

    it("should inject error overlay scripts", () => {
        expect.assertions(3);

        // patchOverlay expects Vite client code with ErrorOverlay class
        const inputCode = `
class ErrorOverlay {
    constructor() {
        // Original ErrorOverlay implementation
    }
}
`;

        const result = patchOverlay(inputCode);

        expect(result).toContain("__v_o__overlay");
        expect(result).toContain("ErrorOverlay");
        expect(result).toContain("window.ErrorOverlay = ErrorOverlay");
    });

    it("should handle empty or invalid input", () => {
        expect.assertions(3);

        expect(() => patchOverlay("")).not.toThrow();
        // patchOverlay expects a string, so null/undefined should cause an error
        expect(() => patchOverlay(null as any)).toThrow();
        expect(() => patchOverlay(undefined as any)).toThrow();
    });

    it("should preserve existing code structure when replacing", () => {
        expect.assertions(3);

        // patchOverlay works with JavaScript code, not HTML
        const inputCode = `
var ErrorOverlay = class {
    constructor(error) {
        this.error = error;
    }
};
`;

        const result = patchOverlay(inputCode);

        expect(result).toContain("var ViteErrorOverlay = ");
        expect(result).toContain("__v_o__overlay");
        expect(result).toContain("window.ErrorOverlay = ErrorOverlay");
    });
});
