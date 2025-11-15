import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { patchOverlay } from "../../../src/overlay/patch-overlay";

// Mock the dependencies
vi.mock(import("../../../../../shared/utils/editors"), () => {
    return {
        default: {
            vscode: "Visual Studio Code",
            webstorm: "WebStorm",
        },
    };
});

vi.mock(import("lucide-static/icons/moon-star.svg?data-uri&encoding=css"), () => {
    return {
        default: "data:image/svg+xml;base64,mock-moon-icon",
    };
});

vi.mock(import("lucide-static/icons/sun.svg?data-uri&encoding=css"), () => {
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

        const result = patchOverlay(inputCode, true);

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

        const result = patchOverlay(inputCode, true);

        expect(result).toContain("__v_o__overlay");
        expect(result).toContain("ErrorOverlay");
        expect(result).toContain("window.ErrorOverlay = ErrorOverlay");
    });

    it("should handle empty or invalid input", () => {
        expect.assertions(3);

        expect(() => patchOverlay("", true)).not.toThrow();
        // patchOverlay expects a string, so null/undefined should cause an error
        expect(() => patchOverlay(null as any, true)).toThrow();
        expect(() => patchOverlay(undefined as any, true)).toThrow();
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

        const result = patchOverlay(inputCode, true);

        expect(result).toContain("var ViteErrorOverlay = ");
        expect(result).toContain("__v_o__overlay");
        expect(result).toContain("window.ErrorOverlay = ErrorOverlay");
    });

    describe("balloon configuration", () => {
        it("should include balloon button by default", () => {
            expect.assertions(2);

            const inputCode = `class ErrorOverlay {}`;

            const result = patchOverlay(inputCode, true);

            expect(result).toContain("__v_o__balloon");
            expect(result).toContain("__v_o__balloon_count");
        });

        it("should exclude balloon button when showBalloonButton is false", () => {
            expect.assertions(1);

            const inputCode = `class ErrorOverlay {}`;

            const result = patchOverlay(inputCode, false);

            expect(result).not.toContain("__v_o__balloon");
        });

        it("should include balloon config when provided", () => {
            expect.assertions(2);

            const inputCode = `class ErrorOverlay {}`;
            const balloonConfig = {
                enabled: true,
                position: "top-left" as const,
                icon: "/custom-icon.svg",
                style: {
                    background: "#111",
                    color: "#fff",
                },
            };

            const result = patchOverlay(inputCode, true, balloonConfig);

            expect(result).toContain("balloonConfig");
            expect(result).toContain('"position":"top-left"');
        });

        it("should exclude balloon when enabled is false", () => {
            expect.assertions(1);

            const inputCode = `class ErrorOverlay {}`;
            const balloonConfig = {
                enabled: false,
            };

            const result = patchOverlay(inputCode, true, balloonConfig);

            expect(result).not.toContain("__v_o__balloon");
        });

        it("should include custom icon when provided", () => {
            expect.assertions(2);

            const inputCode = `class ErrorOverlay {}`;
            const balloonConfig = {
                icon: "/custom-icon.svg",
            };

            const result = patchOverlay(inputCode, true, balloonConfig);

            expect(result).toContain("__v_o__balloon");
            expect(result).toContain('src="/custom-icon.svg"');
        });

        it("should include custom styles when provided", () => {
            expect.assertions(3);

            const inputCode = `class ErrorOverlay {}`;
            const balloonConfig = {
                style: {
                    background: "#111",
                    color: "#fff",
                    borderRadius: "50%",
                },
            };

            const result = patchOverlay(inputCode, true, balloonConfig);

            expect(result).toContain("__v_o__balloon");
            expect(result).toContain("background: #111");
            expect(result).toContain("border-radius: 50%");
        });

        it("should apply position styles correctly", () => {
            expect.assertions(4);

            const positions = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;

            for (const position of positions) {
                const inputCode = `class ErrorOverlay {}`;
                const balloonConfig = { position };

                const result = patchOverlay(inputCode, true, balloonConfig);

                expect(result).toContain(`data-balloon-position="${position}"`);
            }
        });
    });
});
