import { describe, expect, it } from "vitest";

import processHydrationDiff from "../../../../src/utils/error-processing/process-hydration-diff";

const REACT_LINK = "https://react.dev/link/hydration-mismatch";

describe(processHydrationDiff, () => {
    it("returns undefined when no diff markers (+/-) are present", () => {
        expect.assertions(1);

        const error = new Error(`Hydration failed because of mismatch${REACT_LINK}\n<div>same</div>`);

        const result = processHydrationDiff(error);

        expect(result).toBeUndefined();
    });

    it("transforms + and - line prefixes into shiki-diff code markers", () => {
        expect.assertions(2);

        const diff = ["  <div>", "-   server only", "+   client only", "  </div>"].join("\n");
        const error = new Error(`Hydration error${REACT_LINK}\n${diff}`);

        const result = processHydrationDiff(error) ?? "";

        // The source prefixes with "[!code --] " then keeps the original line minus the +/- char.
        expect(result).toContain("[!code --]    server only");
        expect(result).toContain("[!code ++]    client only");
    });

    it("strips ' ...' continuation markers from output", () => {
        expect.assertions(2);

        const diff = ["+   added", "  ...some context with ... inside"].join("\n");
        const error = new Error(`hydration${REACT_LINK}\n${diff}`);

        const result = processHydrationDiff(error) ?? "";

        expect(result).toContain("[!code ++]    added");
        expect(result).not.toContain("...some context");
    });

    it("removes style/script/template tags from the diff content", () => {
        expect.assertions(3);

        const diff = [
            "+   <p>kept</p>",
            "<style>.x { color: red; }</style>",
            "<script>console.log(1)</script>",
            "<template>tpl</template>",
        ].join("\n");
        const error = new Error(`hydration${REACT_LINK}\n${diff}`);

        const result = processHydrationDiff(error) ?? "";

        expect(result).not.toContain("<style>");
        expect(result).not.toContain("<script>");
        expect(result).not.toContain("<template>");
    });

    it("compacts style attributes and removes whitespace inside their values", () => {
        expect.assertions(1);

        const diff = ["+   <p style=\"color: red; font-size: 10px\">y</p>"].join("\n");
        const error = new Error(`hydration${REACT_LINK}\n${diff}`);

        const result = processHydrationDiff(error) ?? "";

        // Spaces inside the style value are stripped; trailing `;` is added.
        expect(result).toContain("style=\"color:red;font-size:10px;\"");
    });

    it("returns undefined when the message has no diff link and no markers", () => {
        expect.assertions(1);

        const error = new Error("Hydration failed");

        const result = processHydrationDiff(error);

        expect(result).toBeUndefined();
    });

    it("trims the hydration prelude from error.message", () => {
        expect.assertions(2);

        const diff = "+   <p>x</p>";
        const error = new Error(`Hydration failed. This can happen if a SSR-ed Client Component used: something${REACT_LINK}\n${diff}`);

        processHydrationDiff(error);

        expect(error.message).not.toContain("This can happen if a SSR-ed Client Component used:");
        expect(error.message).toContain("Hydration failed");
    });

    it("leaves error.message untouched when the message begins with the diff link", () => {
        expect.assertions(2);

        // No text precedes the link, so the leading hydrationMessage segment is empty (falsy)
        // and the message-rewrite branch is skipped.
        const diff = "+   <p>kept</p>";
        const error = new Error(`${REACT_LINK}\n${diff}`);

        const result = processHydrationDiff(error) ?? "";

        expect(error.message).toBe(`${REACT_LINK}\n${diff}`);
        expect(result).toContain("[!code ++]    <p>kept</p>");
    });

    it("keeps a style value that already ends with a semicolon as-is", () => {
        expect.assertions(1);

        const diff = "+   <p style=\"color:red;\">y</p>";
        const error = new Error(`hydration${REACT_LINK}\n${diff}`);

        const result = processHydrationDiff(error) ?? "";

        // The trailing semicolon already exists, so no extra one is appended.
        expect(result).toContain("style=\"color:red;\"");
    });
});
