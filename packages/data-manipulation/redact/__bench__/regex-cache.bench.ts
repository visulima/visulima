import { standardRules } from "@visulima/redact";
import { bench, describe } from "vitest";

// Collect the raw regex pattern sources from the default rule set. With the ~50
// default rules, every string leaf in an object/array would previously trigger a
// fresh `new RegExp(pattern, "giu")` compilation per string. The optimized path
// compiles each pattern once and reuses the instance (resetting `lastIndex`).
const patterns: string[] = [];

for (const rule of standardRules) {
    if (typeof rule === "object" && rule.pattern) {
        patterns.push(typeof rule.pattern === "string" ? rule.pattern : rule.pattern.source);
    }
}

// Pre-compiled instances, mirroring the cached `compiledPattern` field attached
// when rules are prepared in redact().
const compiled = patterns.map((pattern) => new RegExp(pattern, "giu"));

// A batch of string leaves, simulating the many string values walked during a
// single recursiveFilter() traversal of an object.
const stringLeaves = [
    "John Doe will be 30 on 2024-06-10.",
    "Contact johndoe1985@example.com or call +1 (555) 123-4567.",
    "Card 4916 2899 5678 1234 expires soon, token Bearer abc123DEF456ghi789.",
    "AWS key AKIAIOSFODNN7EXAMPLE and id 123-456-789.",
    "Some perfectly ordinary text with no sensitive content at all.",
];

const runMatches = (rx: RegExp, input: string): number => {
    rx.lastIndex = 0;

    let count = 0;
    let match: RegExpExecArray | null;

    // eslint-disable-next-line no-cond-assign
    while ((match = rx.exec(input)) !== null) {
        count += 1;

        // Guard against zero-width matches looping forever.
        if (match.index === rx.lastIndex) {
            rx.lastIndex += 1;
        }
    }

    return count;
};

describe("regex compilation on the string-anonymizer hot path", () => {
    bench("cached compiled RegExp (optimized)", () => {
        for (const input of stringLeaves) {
            for (const rx of compiled) {
                runMatches(rx, input);
            }
        }
    });

    bench("recompile new RegExp per string (previous)", () => {
        for (const input of stringLeaves) {
            for (const pattern of patterns) {
                runMatches(new RegExp(pattern, "giu"), input);
            }
        }
    });
});
