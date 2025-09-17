import { describe, expect, expectTypeOf, it } from "vitest";

import { patchOverlay } from "../../src/overlay/patch-overlay";

describe(patchOverlay, () => {
    it("should return modified code when overlay injection is needed", () => {
        const inputCode = `
<!DOCTYPE html>
<html>
<head>
    <title>Test</title>
</head>
<body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
</body>
</html>`;

        const result = patchOverlay(inputCode);

        expect(result).toBeDefined();

        expectTypeOf(result).toBeString();

        expect(result).not.toBe(inputCode); // Should be modified
    });

    it("should inject error overlay scripts", () => {
        const inputCode = `
<!DOCTYPE html>
<html>
<body>
    <div id="app"></div>
</body>
</html>`;

        const result = patchOverlay(inputCode);

        expect(result).toContain("__flame__overlay");
        expect(result).toContain("ErrorOverlay");
    });

    it("should handle empty or invalid input", () => {
        expect(() => patchOverlay("")).not.toThrow();
        expect(() => patchOverlay(null as any)).not.toThrow();
        expect(() => patchOverlay(undefined as any)).not.toThrow();
    });

    it("should preserve existing HTML structure", () => {
        const inputCode = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Test App</title>
</head>
<body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
</body>
</html>`;

        const result = patchOverlay(inputCode);

        expect(result).toContain('lang="en"');
        expect(result).toContain('charset="UTF-8"');
        expect(result).toContain("<title>Test App</title>");
        expect(result).toContain('<div id="app"></div>');
    });
});
