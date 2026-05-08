import { boxen } from "@visulima/boxen";
import { bold, green } from "@visulima/colorize";
import { useEffect, useLayoutEffect, useState } from "react";
import { describe, expect, it } from "vitest";

import { Box, Newline, Spacer, Static, Text, Transform } from "../../src/components/index";
import { renderToString } from "../../src/ink/index";

const TEXT_INSIDE_TEXT_RE = /must be rendered inside <Text>/u;

describe("render-to-string", () => {
    // ── Basic rendering ─────────────────────────────────────

    it("render simple text", () => {
        expect.assertions(1);

        const output = renderToString(<Text>Hello World</Text>);

        expect(output).toBe("Hello World");
    });

    it("render text with variable", () => {
        expect.assertions(1);

        const output = renderToString(
            <Text>
                Count:
                {42}
            </Text>,
        );

        expect(output).toBe("Count:42");
    });

    it("render nested text components", () => {
        expect.assertions(1);

        const World = () => <Text>World</Text>;

        const output = renderToString(
            <Text>
                Hello
                {" "}
                <World />
            </Text>,
        );

        expect(output).toBe("Hello World");
    });

    it("render empty fragment", () => {
        expect.assertions(1);

        const output = renderToString(<></>);

        expect(output).toBe("");
    });

    it("render null children", () => {
        expect.assertions(1);

        const output = renderToString(<Text>{null}</Text>);

        expect(output).toBe("");
    });

    // ── Layout ──────────────────────────────────────────────

    it("render box with padding", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box paddingLeft={2}>
                <Text>Padded</Text>
            </Box>,
        );

        expect(output).toBe("  Padded");
    });

    it("render box with flex direction row", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box>
                <Text>A</Text>
                <Text>B</Text>
                <Text>C</Text>
            </Box>,
        );

        expect(output).toBe("ABC");
    });

    it("render box with flex direction column", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box flexDirection="column">
                <Text>Line 1</Text>
                <Text>Line 2</Text>
            </Box>,
        );

        expect(output).toBe("Line 1\nLine 2");
    });

    it("render margin", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box marginLeft={2}>
                <Text>Margined</Text>
            </Box>,
        );

        expect(output).toBe("  Margined");
    });

    it("render gap between items", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box gap={1}>
                <Text>A</Text>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe("A B");
    });

    it("render box with fixed width and height", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box height={3} width={10}>
                <Text>Hi</Text>
            </Box>,
        );

        const lines = output.split("\n");

        expect(lines).toHaveLength(3);
    });

    it("render spacer pushes content apart", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box width={20}>
                <Text>Left</Text>
                <Spacer />
                <Text>Right</Text>
            </Box>,
        );

        expect(output).toBe("Left           Right");
    });

    it("render newline inserts blank line", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box flexDirection="column">
                <Text>Above</Text>
                <Newline />
                <Text>Below</Text>
            </Box>,
        );

        expect(output).toBe("Above\n\n\nBelow");
    });

    it("render box with border", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box borderStyle="single" width={20}>
                <Text>Bordered</Text>
            </Box>,
            { columns: 20 },
        );

        expect(output).toBe(
            boxen("Bordered", {
                borderStyle: "single",
                width: 20,
            }),
        );
    });

    // ── Styling ─────────────────────────────────────────────

    it("render colored text", () => {
        expect.assertions(1);

        const output = renderToString(<Text color="green">Green</Text>);

        expect(output).toBe(green("Green"));
    });

    it("render bold text", () => {
        expect.assertions(1);

        const output = renderToString(<Text bold>Bold</Text>);

        expect(output).toBe(bold("Bold"));
    });

    // ── Text wrapping and columns ───────────────────────────

    it("render text with wrap", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box width={7}>
                <Text wrap="wrap">Hello World</Text>
            </Box>,
        );

        expect(output).toBe("Hello\nWorld");
    });

    it("render text with truncate", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box width={7}>
                <Text wrap="truncate">Hello World</Text>
            </Box>,
        );

        expect(output).toBe("Hello …");
    });

    it("default columns is 80", () => {
        expect.assertions(3);

        const longText = "A".repeat(100);
        const output = renderToString(<Text>{longText}</Text>);

        const lines = output.split("\n");

        expect(lines).toHaveLength(2);
        expect(lines[0]).toBe("A".repeat(80));
        expect(lines[1]).toBe("A".repeat(20));
    });

    it("custom columns option", () => {
        expect.assertions(3);

        const longText = "A".repeat(50);
        const output = renderToString(<Text>{longText}</Text>, { columns: 30 });

        const lines = output.split("\n");

        expect(lines).toHaveLength(2);
        expect(lines[0]).toBe("A".repeat(30));
        expect(lines[1]).toBe("A".repeat(20));
    });

    // ── Components ──────────────────────────────────────────

    it("render Transform component", () => {
        expect.assertions(1);

        const output = renderToString(
            <Transform transform={(output) => output.toUpperCase()}>
                <Text>hello</Text>
            </Transform>,
        );

        expect(output).toBe("HELLO");
    });

    it("render Static component with items", () => {
        expect.assertions(1);

        const items = ["A", "B", "C"];

        const output = renderToString(
            <Box flexDirection="column">
                <Static items={items}>{(item) => <Text key={item}>{item}</Text>}</Static>
                <Text>Dynamic</Text>
            </Box>,
        );

        expect(output).toBe("A\nB\nC\nDynamic");
    });

    it("render static-only output has no trailing newline", () => {
        expect.assertions(1);

        const items = ["A", "B"];

        const output = renderToString(<Static items={items}>{(item) => <Text key={item}>{item}</Text>}</Static>);

        expect(output).toBe("A\nB");
    });

    it("render static + dynamic output has exactly one newline between parts", () => {
        expect.assertions(1);

        const items = ["A", "B"];

        const output = renderToString(
            <Box flexDirection="column">
                <Static items={items}>{(item) => <Text key={item}>{item}</Text>}</Static>
                <Text>Dynamic</Text>
            </Box>,
        );

        expect(output).toBe("A\nB\nDynamic");
    });

    // ── Effect behavior ─────────────────────────────────────

    it("captures initial render output before effect-driven state updates", () => {
        expect.assertions(1);

        const App = () => {
            const [text, setText] = useState("Initial");

            useEffect(() => {
                setText("Updated");
            }, []);

            return <Text>{text}</Text>;
        };

        const output = renderToString(<App />);

        expect(output).toBe("Initial");
    });

    it("useLayoutEffect state updates are reflected in output", () => {
        expect.assertions(1);

        const App = () => {
            const [text, setText] = useState("Initial");

            useLayoutEffect(() => {
                setText("Layout Updated");
            }, []);

            return <Text>{text}</Text>;
        };

        const output = renderToString(<App />);

        expect(output).toBe("Layout Updated");
    });

    it("runs effect cleanup on teardown", () => {
        expect.assertions(2);

        let cleanupRan = false;

        const App = () => {
            useEffect(
                () => () => {
                    cleanupRan = true;
                },
                [],
            );

            return <Text>Cleanup test</Text>;
        };

        const output = renderToString(<App />);

        expect(output).toBe("Cleanup test");
        expect(cleanupRan).toBe(true);
    });

    // ── Error handling ──────────────────────────────────────

    it("component that throws propagates the error", () => {
        expect.assertions(1);

        const Broken = (): React.JSX.Element => {
            throw new Error("Component error");
        };

        expect(() => renderToString(<Broken />)).toThrow("Component error");
    });

    it("text outside Text component throws", () => {
        expect.assertions(1);

        expect(() => renderToString(<Box>raw text</Box>)).toThrow(TEXT_INSIDE_TEXT_RE);
    });

    it("subsequent calls work after a component error", () => {
        expect.assertions(2);

        const Broken = (): React.JSX.Element => {
            throw new Error("Boom");
        };

        expect(() => renderToString(<Broken />)).toThrow("Boom");

        const output = renderToString(<Text>Still works</Text>);

        expect(output).toBe("Still works");
    });

    // ── Independence ────────────────────────────────────────

    it("can be called multiple times independently", () => {
        expect.assertions(2);

        const output1 = renderToString(<Text>First</Text>);
        const output2 = renderToString(<Text>Second</Text>);

        expect(output1).toBe("First");
        expect(output2).toBe("Second");
    });

    // ── Deeply nested tree ──────────────────────────────────

    it("render deeply nested component tree", () => {
        expect.assertions(2);

        const output = renderToString(
            <Box flexDirection="column">
                <Box paddingLeft={1}>
                    <Box>
                        <Text bold>
                            {"Nested "}
                            <Text color="green">deep</Text>
                        </Text>
                    </Box>
                </Box>
            </Box>,
        );

        expect(output).toContain("Nested");
        expect(output).toContain("deep");
    });
});
