import { describe, expect, it } from "vitest";

import aiSolutionResponse from "../../../src/solution/ai/ai-solution-response";

describe("solution/ai/ai-solution-response", () => {
    it("formats the fix description and links from a well-formed response", () => {
        expect.assertions(4);

        const raw = [
            "FIX",
            "Replace the \"default\" import with a named import.",
            "ENDFIX",
            "LINKS",
            "{\"title\": \"MDN import\", \"url\": \"https://developer.mozilla.org/import\"}",
            "{\"title\": \"Node docs\", \"url\": \"https://nodejs.org/esm\"}",
            "ENDLINKS",
        ].join("\n");

        const result = aiSolutionResponse(raw);

        expect(result).toContain("<code>default</code>");
        expect(result).toContain("## Links");
        expect(result).toContain("https://developer.mozilla.org/import");
        expect(result).toContain("This solution was generated with the");
    });

    it("returns the fallback message when no FIX block is present", () => {
        expect.assertions(2);

        const result = aiSolutionResponse("There is no fix block here.");

        expect(result).toContain("No solution found.");
        expect(result).toContain("There is no fix block here.");
    });

    it("returns the fallback message when the FIX start marker exists but the end marker is missing", () => {
        expect.assertions(1);

        const result = aiSolutionResponse("FIX this is never closed");

        expect(result).toContain("No solution found.");
    });

    it("escapes HTML in the fix description so injected markup cannot execute", () => {
        expect.assertions(2);

        const raw = ["FIX", "Remove <script>alert(1)</script> from the file.", "ENDFIX"].join("\n");

        const result = aiSolutionResponse(raw);

        expect(result).not.toContain("<script>");
        expect(result).toContain("&lt;script&gt;");
    });

    it("escapes HTML in the raw text on the fallback path", () => {
        expect.assertions(2);

        const result = aiSolutionResponse("<img src=x onerror=alert(1)>");

        expect(result).not.toContain("<img src=x onerror=alert(1)>");
        expect(result).toContain("&lt;img");
    });

    it("drops links with non-http(s) URLs", () => {
        expect.assertions(2);

        const raw = [
            "FIX",
            "Do the thing.",
            "ENDFIX",
            "LINKS",
            "{\"title\": \"evil\", \"url\": \"javascript:alert(1)\"}",
            "{\"title\": \"ok\", \"url\": \"https://example.com/safe\"}",
            "ENDLINKS",
        ].join("\n");

        const result = aiSolutionResponse(raw);

        expect(result).not.toContain("javascript:alert(1)");
        expect(result).toContain("https://example.com/safe");
    });

    it("escapes HTML in link titles and URLs", () => {
        expect.assertions(2);

        const raw = [
            "FIX",
            "Do the thing.",
            "ENDFIX",
            "LINKS",
            "{\"title\": \"<b>x</b>\", \"url\": \"https://example.com/?a=1&b=2\"}",
            "ENDLINKS",
        ].join("\n");

        const result = aiSolutionResponse(raw);

        expect(result).not.toContain("<b>x</b>");
        expect(result).toContain("&lt;b&gt;x&lt;/b&gt;");
    });
});
