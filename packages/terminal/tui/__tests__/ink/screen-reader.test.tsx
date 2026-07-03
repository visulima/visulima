import { describe, expect, it } from "vitest";

import { Box, Text } from "../../src/components/index";
import { renderToString } from "../helpers/ink-render";

describe("screen-reader", () => {
    it("render text for screen readers", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box aria-label="Hello World">
                <Text>Not visible to screen readers</Text>
            </Box>,
            {
                isScreenReaderEnabled: true,
            },
        );

        expect(output).toBe("Hello World");
    });

    it("render text for screen readers with aria-hidden", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box aria-hidden>
                <Text>Not visible to screen readers</Text>
            </Box>,
            {
                isScreenReaderEnabled: true,
            },
        );

        expect(output).toBe("");
    });

    it("render text for screen readers with aria-role", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box aria-role="button">
                <Text>Click me</Text>
            </Box>,
            {
                isScreenReaderEnabled: true,
            },
        );

        expect(output).toBe("button: Click me");
    });

    it("render select input for screen readers", () => {
        expect.assertions(1);

        const items = ["Red", "Green", "Blue"];

        const output = renderToString(
            <Box aria-role="list" flexDirection="column">
                <Text>Select a color:</Text>
                {items.map((item, index) => {
                    const isSelected = index === 1;
                    const screenReaderLabel = `${index + 1}. ${item}`;

                    return (
                        <Box aria-label={screenReaderLabel} aria-role="listitem" aria-state={{ selected: isSelected }} key={item}>
                            <Text>{item}</Text>
                        </Box>
                    );
                })}
            </Box>,
            {
                isScreenReaderEnabled: true,
            },
        );

        expect(output).toBe("list: Select a color:\nlistitem: 1. Red\nlistitem: (selected) 2. Green\nlistitem: 3. Blue");
    });

    it("render aria-label only Text for screen readers", () => {
        expect.assertions(1);

        const output = renderToString(<Text aria-label="Screen-reader only" />, {
            isScreenReaderEnabled: true,
        });

        expect(output).toBe("Screen-reader only");
    });

    it("render aria-label only Box for screen readers", () => {
        expect.assertions(1);

        const output = renderToString(<Box aria-label="Screen-reader only" />, {
            isScreenReaderEnabled: true,
        });

        expect(output).toBe("Screen-reader only");
    });

    it("omit ANSI styling in screen-reader output", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box>
                {}
                <Text bold color="green" inverse underline>
                    Styled content
                </Text>
            </Box>,
            {
                isScreenReaderEnabled: true,
            },
        );

        expect(output).toBe("Styled content");
    });

    it("skip nodes with display:none style in screen-reader output", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box>
                <Box display="none">
                    <Text>Hidden</Text>
                </Box>
                <Text>Visible</Text>
            </Box>,
            { isScreenReaderEnabled: true },
        );

        expect(output).toBe("Visible");
    });

    it("render multiple Text components", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box flexDirection="column">
                <Text>Hello</Text>
                <Text>World</Text>
            </Box>,
            {
                isScreenReaderEnabled: true,
            },
        );

        expect(output).toBe("Hello\nWorld");
    });

    it("render nested Box components with Text", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box flexDirection="column">
                <Text>Hello</Text>
                <Box>
                    <Text>World</Text>
                </Box>
            </Box>,
            {
                isScreenReaderEnabled: true,
            },
        );

        expect(output).toBe("Hello\nWorld");
    });

    const NullComponent = (): undefined => undefined;

    it("render component that returns null", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box flexDirection="column">
                <Text>Hello</Text>
                <NullComponent />
                <Text>World</Text>
            </Box>,
            {
                isScreenReaderEnabled: true,
            },
        );

        expect(output).toBe("Hello\nWorld");
    });

    it("render with aria-state.busy", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box aria-state={{ busy: true }}>
                <Text>Loading</Text>
            </Box>,
            {
                isScreenReaderEnabled: true,
            },
        );

        expect(output).toBe("(busy) Loading");
    });

    it("render with aria-state.checked", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box aria-role="checkbox" aria-state={{ checked: true }}>
                <Text>Accept terms</Text>
            </Box>,
            {
                isScreenReaderEnabled: true,
            },
        );

        expect(output).toBe("checkbox: (checked) Accept terms");
    });

    it("render with aria-state.disabled", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box aria-role="button" aria-state={{ disabled: true }}>
                <Text>Submit</Text>
            </Box>,
            {
                isScreenReaderEnabled: true,
            },
        );

        expect(output).toBe("button: (disabled) Submit");
    });

    it("render with aria-state.expanded", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box aria-role="combobox" aria-state={{ expanded: true }}>
                <Text>Select</Text>
            </Box>,
            {
                isScreenReaderEnabled: true,
            },
        );

        expect(output).toBe("combobox: (expanded) Select");
    });

    it("render with aria-state.multiline", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box aria-role="textbox" aria-state={{ multiline: true }}>
                <Text>Hello</Text>
            </Box>,
            {
                isScreenReaderEnabled: true,
            },
        );

        expect(output).toBe("textbox: (multiline) Hello");
    });

    it("render with aria-state.multiselectable", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box aria-role="listbox" aria-state={{ multiselectable: true }}>
                <Text>Options</Text>
            </Box>,
            {
                isScreenReaderEnabled: true,
            },
        );

        expect(output).toBe("listbox: (multiselectable) Options");
    });

    it("render with aria-state.readonly", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box aria-role="textbox" aria-state={{ readonly: true }}>
                <Text>Hello</Text>
            </Box>,
            {
                isScreenReaderEnabled: true,
            },
        );

        expect(output).toBe("textbox: (readonly) Hello");
    });

    it("render with aria-state.required", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box aria-role="textbox" aria-state={{ required: true }}>
                <Text>Name</Text>
            </Box>,
            {
                isScreenReaderEnabled: true,
            },
        );

        expect(output).toBe("textbox: (required) Name");
    });

    it("render with aria-state.selected", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box aria-role="option" aria-state={{ selected: true }}>
                <Text>Blue</Text>
            </Box>,
            {
                isScreenReaderEnabled: true,
            },
        );

        expect(output).toBe("option: (selected) Blue");
    });

    it("render multi-line text", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box flexDirection="column">
                <Text>Line 1</Text>
                <Text>Line 2</Text>
            </Box>,
            {
                isScreenReaderEnabled: true,
            },
        );

        expect(output).toBe("Line 1\nLine 2");
    });

    it("render nested multi-line text", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box flexDirection="row">
                <Box flexDirection="column">
                    <Text>Line 1</Text>
                    <Text>Line 2</Text>
                </Box>
            </Box>,
            {
                isScreenReaderEnabled: true,
            },
        );

        expect(output).toBe("Line 1\nLine 2");
    });

    it("render nested row", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box flexDirection="column">
                <Box flexDirection="row">
                    <Text>Line 1</Text>
                    <Text>Line 2</Text>
                </Box>
            </Box>,
            {
                isScreenReaderEnabled: true,
            },
        );

        expect(output).toBe("Line 1 Line 2");
    });

    it("render multi-line text with roles", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box aria-role="list" flexDirection="column">
                <Box aria-role="listitem">
                    <Text>Item 1</Text>
                </Box>
                <Box aria-role="listitem">
                    <Text>Item 2</Text>
                </Box>
            </Box>,
            {
                isScreenReaderEnabled: true,
            },
        );

        expect(output).toBe("list: listitem: Item 1\nlistitem: Item 2");
    });

    it("render listbox with multiselectable options", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box aria-role="listbox" aria-state={{ multiselectable: true }} flexDirection="column">
                <Box aria-role="option" aria-state={{ selected: true }}>
                    <Text>Option 1</Text>
                </Box>
                <Box aria-role="option" aria-state={{ selected: false }}>
                    <Text>Option 2</Text>
                </Box>
                <Box aria-role="option" aria-state={{ selected: true }}>
                    <Text>Option 3</Text>
                </Box>
            </Box>,
            {
                isScreenReaderEnabled: true,
            },
        );

        expect(output).toBe("listbox: (multiselectable) option: (selected) Option 1\noption: Option 2\noption: (selected) Option 3");
    });
});
