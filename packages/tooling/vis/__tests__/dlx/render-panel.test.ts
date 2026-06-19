import { stripVTControlCharacters } from "node:util";

import { getStringWidth } from "@visulima/string";
import { describe, expect, it } from "vitest";

import type { PackageInfo } from "../../src/dlx/package-info";
import { formatBytes, renderFirstRunPanel } from "../../src/dlx/render-panel";

describe(formatBytes, () => {
    it.each([
        [undefined, undefined],
        [-1, undefined],
        [512, "512 B"],
        [2048, "2.0 KB"],
        [1_234_567, "1.2 MB"],
    ])("formats %s", (input, expected) => {
        expect.assertions(1);

        expect(formatBytes(input)).toBe(expected);
    });
});

describe(renderFirstRunPanel, () => {
    const info: PackageInfo = {
        changelog: { lines: ["- fix: a thing"], source: "repo-file", version: "1.0.0" },
        name: "demo",
        permissions: { bins: ["demo"], capabilities: ["network"], lifecycleScripts: ["postinstall"] },
        security: {
            alerts: [{ category: "supplyChainRisk", key: "k1", severity: "medium", type: "envVars" }],
            available: true,
            highSeverityKeys: [],
            score: 84,
        },
        size: { fileCount: 10, tarballBytes: 4096, unpackedBytes: 1_234_567 },
        version: "1.0.0",
    };

    it("renders a titled box with size, score, perms and changelog rows", () => {
        expect.assertions(5);

        const plain = renderFirstRunPanel(info).map((line) => stripVTControlCharacters(line));

        expect(plain[0]).toContain("first run: demo@1.0.0");
        expect(plain.join("\n")).toContain("1.2 MB unpacked");
        expect(plain.join("\n")).toContain("84/100");
        expect(plain.join("\n")).toContain("postinstall script");
        expect(plain.join("\n")).toContain("fix: a thing");
    });

    it("aligns every body row to the same border width", () => {
        expect.assertions(1);

        const widths = new Set(renderFirstRunPanel(info).map((line) => getStringWidth(stripVTControlCharacters(line))));

        // Top border, body rows and bottom border share one outer width.
        expect(widths.size).toBe(1);
    });

    it("notes when no security token is configured", () => {
        expect.assertions(1);

        const noToken = { ...info, security: { alerts: [], available: false, highSeverityKeys: [], score: undefined } };
        const plain = renderFirstRunPanel(noToken)
            .map((line) => stripVTControlCharacters(line))
            .join("\n");

        expect(plain).toContain("VIS_SOCKET_TOKEN");
    });
});
