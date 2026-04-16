import React from "react";
import { describe, expect, it } from "vitest";

import { MessageBubble, StreamingText, Text } from "../../src/ink/index";
import { renderToString } from "../helpers/ink-render";

describe(MessageBubble, () => {
    it("should render body content", () => {
        expect.assertions(1);

        const output = renderToString(
            <MessageBubble>I'll fix the bug.</MessageBubble>,
        );

        expect(output).toContain("I'll fix the bug.");
    });

    it("should render label and meta in the header", () => {
        expect.assertions(2);

        const output = renderToString(
            <MessageBubble label="Claude" meta="10:00">
                <Text>Hello</Text>
            </MessageBubble>,
        );

        expect(output).toContain("Claude");
        expect(output).toContain("10:00");
    });

    it("should render without a border in flat mode", () => {
        expect.assertions(1);

        const output = renderToString(<MessageBubble flat>plain text</MessageBubble>);

        expect(output).toContain("plain text");
    });
});

describe(StreamingText, () => {
    it("should render only the cursor on the initial paint", () => {
        expect.assertions(2);

        const output = renderToString(<StreamingText interval={10} text="Hello" />);

        // On the first paint the streamed text has not been revealed yet
        expect(output).not.toContain("Hello");
        // But the cursor should be visible
        expect(output).toContain("▊");
    });

    it("should accept a custom cursor character", () => {
        expect.assertions(1);

        const output = renderToString(<StreamingText cursor="█" interval={10} text="Hi" />);

        expect(output).toContain("█");
    });
});
