import { describe, expect, it } from "vitest";

import type { FailureContext } from "../src/ai/ai-failure-context";
import type { FixProposal } from "../src/ai/ai-fix";
import { pickFenceForTesting, renderCommentBodyForTesting, renderProposalDiffForTesting } from "../src/commands/ai/heal";

const failureContext = (overrides: Partial<FailureContext> = {}): FailureContext => {
    return {
        command: "vitest run",
        cwd: undefined,
        dependencies: [],
        duration: undefined,
        exitCode: 1,
        hash: undefined,
        hashDetails: undefined,
        hashDiff: undefined,
        previousRunId: undefined,
        project: "myapp",
        runId: "2026-04-28T00-00-00_aaa",
        status: "failure",
        target: "test",
        taskId: "myapp:test",
        terminalOutput: "",
        terminalOutputCaptured: true,
        timestamp: undefined,
        ...overrides,
    };
};

const proposal = (overrides: Partial<FixProposal> = {}): FixProposal => {
    return {
        confidence: "medium",
        explanation: "Renamed `foo` to `bar`.",
        patches: [
            {
                file: "src/index.ts",
                newString: "const bar = 1;",
                oldString: "const foo = 1;",
                reason: "rename",
            },
        ],
        provider: "anthropic",
        ...overrides,
    };
};

describe(pickFenceForTesting, () => {
    it("should default to a triple backtick fence when content has none", () => {
        expect.assertions(1);
        expect(pickFenceForTesting("plain content")).toBe("```");
    });

    it("should pick a longer fence when content contains triple backticks", () => {
        expect.assertions(1);
        expect(pickFenceForTesting("```js\ncode\n```")).toBe("````");
    });

    it("should pick a fence longer than the longest backtick run in the content", () => {
        expect.assertions(1);
        expect(pickFenceForTesting("look: `````` six")).toBe("```````");
    });
});

describe(renderProposalDiffForTesting, () => {
    it("should produce a triple-backtick diff fence for normal content", () => {
        expect.assertions(2);

        const out = renderProposalDiffForTesting(proposal(), "/ws", undefined);

        expect(out).toContain("```diff");
        expect(out).toContain("- const foo = 1;");
    });

    it("should escalate the fence when patch content contains triple backticks", () => {
        expect.assertions(2);

        const out = renderProposalDiffForTesting(
            proposal({
                patches: [
                    {
                        file: "README.md",
                        newString: "after\n```js\nx()\n```",
                        oldString: "before\n```\nold\n```",
                    },
                ],
            }),
            "/ws",
            undefined,
        );

        // The fence must be longer than any backtick run in the content
        // so the markdown block doesn't close prematurely.
        expect(out).toContain("````diff");
        // The opening fence appears as `^\`{4,}diff$` — at least 4 ticks.
        expect(out).toMatch(/^`{4,}diff$/m);
    });

    it("should announce empty patch sets explicitly", () => {
        expect.assertions(1);
        expect(renderProposalDiffForTesting(proposal({ patches: [] }), "/ws", undefined)).toBe("_No patches proposed._");
    });
});

describe(renderCommentBodyForTesting, () => {
    it("should include task ID, root cause, validation, and apply hint", () => {
        expect.assertions(5);

        const body = renderCommentBodyForTesting(proposal(), failureContext(), "/ws", "abcdef0123");

        expect(body).toContain("vis ai heal");
        expect(body).toContain("`myapp:test`");
        expect(body).toContain("Renamed `foo` to `bar`.");
        expect(body).toContain("vis ai fix myapp:test --apply");
        expect(body).toContain("`abcdef0`");
    });

    it("should not contain emoji (project convention: no emojis unless asked)", () => {
        expect.assertions(1);

        const body = renderCommentBodyForTesting(proposal(), failureContext(), "/ws", undefined);

        // Surrogate-pair test: catch any U+1F300+ codepoints we might
        // accidentally re-add to the comment template.
        expect(body).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    });

    it("should truncate the diff section when the comment exceeds 60 KB", () => {
        expect.assertions(2);

        // 80 KB of patch content guarantees we trip the cap.
        const huge = "x".repeat(80_000);

        const body = renderCommentBodyForTesting(
            proposal({
                patches: [
                    { file: "src/big.ts", newString: huge, oldString: huge },
                ],
            }),
            failureContext(),
            "/ws",
            undefined,
        );

        expect(body).not.toContain(huge);
        expect(body).toContain("Patch set is too large");
    });
});
