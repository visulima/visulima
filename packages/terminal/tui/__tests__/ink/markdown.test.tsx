import delay from "delay";
import React from "react";
import type { vi } from "vitest";
import { afterEach, describe, expect, it } from "vitest";

import { Markdown } from "../../src/components/markdown";
import { render } from "../../src/ink/index";
import { createStdin } from "../helpers/ink-create-stdin";
import createStdout from "../helpers/ink-create-stdout";

describe(Markdown, () => {
    let currentUnmount: (() => void) | undefined;

    const setup = async (jsx: React.JSX.Element, waitMs = 100) => {
        const stdout = createStdout();
        const stdin = createStdin();
        const { unmount } = render(jsx, { debug: true, stdin, stdout });

        currentUnmount = unmount;
        await delay(waitMs);

        const getOutput = () => {
            const { calls } = (stdout.write as ReturnType<typeof vi.fn>).mock;

            for (let index = calls.length - 1; index >= 0; index--) {
                const argument = calls[index]?.[0] as string;

                if (typeof argument === "string" && argument.length > 0 && !argument.startsWith("\u001B[?")) {
                    return argument;
                }
            }

            return "";
        };

        return { getOutput, stdin, stdout };
    };

    afterEach(async () => {
        currentUnmount?.();
        currentUnmount = undefined;
        await delay(100);
    });

    it("should render headings", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<Markdown># Hello World</Markdown>);

        expect(getOutput()).toContain("Hello World");
    });

    it("should render paragraphs", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<Markdown>This is a paragraph.</Markdown>);

        expect(getOutput()).toContain("This is a paragraph.");
    });

    it("should render bold text", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<Markdown>This is **bold** text.</Markdown>);
        const output = getOutput();

        expect(output).toContain("bold");
    });

    it("should render italic text", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<Markdown>This is *italic* text.</Markdown>);
        const output = getOutput();

        expect(output).toContain("italic");
    });

    it("should render inline code", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<Markdown>Use `console.log` here.</Markdown>);

        expect(getOutput()).toContain("console.log");
    });

    it("should render code blocks", async () => {
        expect.assertions(1);

        const md = "```js\nconst x = 1;\n```";
        const { getOutput } = await setup(<Markdown>{md}</Markdown>, 2000);
        const output = getOutput();

        // Shiki wraps tokens in ANSI color codes, so strip them for assertion
        // eslint-disable-next-line no-control-regex
        const plain = output.replaceAll(/\u001B\[[^m]*m/g, "");

        expect(plain).toContain("const x = 1;");
    });

    it("should render horizontal rules", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<Markdown>---</Markdown>);
        const output = getOutput();

        expect(output).toContain("─");
    });

    it("should render blockquotes", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<Markdown>{"> This is a quote"}</Markdown>);

        expect(getOutput()).toContain("This is a quote");
    });

    it("should render links", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<Markdown>[Click here](https://example.com)</Markdown>);

        expect(getOutput()).toContain("Click here");
    });

    it("should render unordered lists", async () => {
        expect.assertions(2);

        const md = "- Item 1\n- Item 2\n- Item 3";
        const { getOutput } = await setup(<Markdown>{md}</Markdown>);
        const output = getOutput();

        expect(output).toContain("Item 1");
        expect(output).toContain("Item 2");
    });

    it("should render ordered lists", async () => {
        expect.assertions(2);

        const md = "1. First\n2. Second\n3. Third";
        const { getOutput } = await setup(<Markdown>{md}</Markdown>);
        const output = getOutput();

        expect(output).toContain("First");
        expect(output).toContain("Second");
    });

    it("should handle empty markdown", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<Markdown />);

        expect(getOutput()).toBeDefined();
    });

    it("should render multiple headings at different levels", async () => {
        expect.assertions(2);

        const md = "# H1\n\n## H2\n\n### H3";
        const { getOutput } = await setup(<Markdown>{md}</Markdown>);
        const output = getOutput();

        expect(output).toContain("H1");
        expect(output).toContain("H2");
    });

    it("should handle strikethrough", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<Markdown>This is ~~deleted~~ text.</Markdown>);

        expect(getOutput()).toContain("deleted");
    });

    it("should render in streaming mode with incomplete markdown", async () => {
        expect.assertions(1);

        // Simulate an unclosed code fence (common during LLM streaming)
        const incompleteMd = "# Title\n\nSome text\n\n```js\nconst x = 1;";
        const { getOutput } = await setup(<Markdown streaming>{incompleteMd}</Markdown>);
        const output = getOutput();

        expect(output).toContain("Title");
    });

    it("should render in streaming mode with complete markdown", async () => {
        expect.assertions(2);

        const completeMd = "# Done\n\nAll finished.";
        const { getOutput } = await setup(<Markdown streaming>{completeMd}</Markdown>);
        const output = getOutput();

        expect(output).toContain("Done");
        expect(output).toContain("All finished");
    });
});
