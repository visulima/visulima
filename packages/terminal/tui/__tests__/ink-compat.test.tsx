import React, { Suspense, useState, useTransition } from "react";
import { describe, expect, it } from "vitest";

import { renderToString, Static, useFocus, useStderr, useStdout } from "../src/react/index";
import { _Box as Box, _Spacer as Spacer, _Text as Text } from "../src/react/react";

const Newline: React.FC<{ count?: number }> = ({ count = 1 }) => React.createElement(Text, {}, "\n".repeat(count));

const BLOCK_CHARS_RE = /[█▓▒░▪▫●○◆◇]/;

// React Suspense requires throwing a Promise — wrap in a typed helper to satisfy ESLint
const suspendForever = (): never => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Suspense requires throwing a Promise
    throw new Promise(() => {});
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Render a component and return its string output.
 * Defaults to 80×24 unless overridden.
 */
const renderTest = (element: React.ReactElement, options?: { columns?: number; rows?: number }): string =>
    renderToString(element, { columns: 80, rows: 24, ...options });

// ---------------------------------------------------------------------------
// Layout / Component tests
// These test the initial synchronous render output. Components that rely on
// useEffect timers will only show their initial state, which is exactly what
// we want for deterministic snapshot testing.
// ---------------------------------------------------------------------------

describe("ink compatibility - borders", () => {
    const Borders = () => (
        <Box flexDirection="column" padding={2}>
            <Box>
                <Box borderStyle="single" marginRight={2}>
                    <Text>single</Text>
                </Box>
                <Box borderStyle="double" marginRight={2}>
                    <Text>double</Text>
                </Box>
                <Box borderStyle="round" marginRight={2}>
                    <Text>round</Text>
                </Box>
                <Box borderStyle="bold">
                    <Text>bold</Text>
                </Box>
            </Box>
            <Box marginTop={1}>
                <Box borderStyle="singleDouble" marginRight={2}>
                    <Text>singleDouble</Text>
                </Box>
                <Box borderStyle="doubleSingle" marginRight={2}>
                    <Text>doubleSingle</Text>
                </Box>
                <Box borderStyle="classic">
                    <Text>classic</Text>
                </Box>
            </Box>
        </Box>
    );

    it("should render all border styles", () => {
        expect.assertions(7);

        const output = renderTest(<Borders />, { columns: 60 });

        expect(output).toContain("single");
        expect(output).toContain("double");
        expect(output).toContain("round");
        expect(output).toContain("bold");
        expect(output).toContain("singleDouble");
        expect(output).toContain("doubleSingle");
        expect(output).toContain("classic");
    });

    it("should match snapshot", () => {
        expect.assertions(1);

        const output = renderTest(<Borders />, { columns: 60 });

        expect(output).toMatchSnapshot();
    });
});

describe("ink compatibility - box-backgrounds", () => {
    const BoxBackgrounds = () => (
        <Box flexDirection="column" gap={1}>
            <Text bold>Box Background Examples:</Text>
            <Box alignSelf="flex-start" backgroundColor="red" height={3} width={10}>
                <Text>Hello</Text>
            </Box>
            <Box alignSelf="flex-start" backgroundColor="blue" borderStyle="round" height={4} width={12}>
                <Text>Border</Text>
            </Box>
            <Box alignSelf="flex-start" backgroundColor="green" height={4} padding={1} width={14}>
                <Text>Padding</Text>
            </Box>
            <Box alignSelf="flex-start" backgroundColor="yellow" height={3} justifyContent="center" width={16}>
                <Text>Centered</Text>
            </Box>
            <Box alignSelf="flex-start" backgroundColor="cyan">
                <Text>Inherited </Text>
                <Text backgroundColor="red">Override </Text>
                <Text>Back to inherited</Text>
            </Box>
        </Box>
    );

    it("should render backgrounds and text", () => {
        expect.assertions(7);

        const output = renderTest(<BoxBackgrounds />);

        expect(output).toContain("Box Background Examples:");
        expect(output).toContain("Hello");
        expect(output).toContain("Border");
        expect(output).toContain("Padding");
        expect(output).toContain("Centered");
        expect(output).toContain("Inherited");
        expect(output).toContain("Override");
    });

    it("should match snapshot", () => {
        expect.assertions(1);

        const output = renderTest(<BoxBackgrounds />);

        expect(output).toMatchSnapshot();
    });
});

describe("ink compatibility - justify-content", () => {
    const JustifyContent = () => (
        <Box flexDirection="column">
            <Box>
                <Text>[</Text>
                <Box height={1} justifyContent="flex-start" width={20}>
                    <Text>X</Text>
                    <Text>Y</Text>
                </Box>
                <Text>] flex-start</Text>
            </Box>
            <Box>
                <Text>[</Text>
                <Box height={1} justifyContent="flex-end" width={20}>
                    <Text>X</Text>
                    <Text>Y</Text>
                </Box>
                <Text>] flex-end</Text>
            </Box>
            <Box>
                <Text>[</Text>
                <Box height={1} justifyContent="center" width={20}>
                    <Text>X</Text>
                    <Text>Y</Text>
                </Box>
                <Text>] center</Text>
            </Box>
            <Box>
                <Text>[</Text>
                <Box height={1} justifyContent="space-around" width={20}>
                    <Text>X</Text>
                    <Text>Y</Text>
                </Box>
                <Text>] space-around</Text>
            </Box>
            <Box>
                <Text>[</Text>
                <Box height={1} justifyContent="space-between" width={20}>
                    <Text>X</Text>
                    <Text>Y</Text>
                </Box>
                <Text>] space-between</Text>
            </Box>
            <Box>
                <Text>[</Text>
                <Box height={1} justifyContent="space-evenly" width={20}>
                    <Text>X</Text>
                    <Text>Y</Text>
                </Box>
                <Text>] space-evenly</Text>
            </Box>
        </Box>
    );

    it("should render all justify-content modes", () => {
        expect.assertions(6);

        const output = renderTest(<JustifyContent />, { columns: 40 });

        expect(output).toContain("flex-start");
        expect(output).toContain("flex-end");
        expect(output).toContain("center");
        expect(output).toContain("space-around");
        expect(output).toContain("space-between");
        expect(output).toContain("space-evenly");
    });

    it("should position X and Y correctly", () => {
        expect.assertions(6);

        const output = renderTest(<JustifyContent />, { columns: 40 });

        // All modes should contain both X and Y
        const lines = output.split("\n");

        lines.forEach((line) => {
            if (line.includes("flex-start") || line.includes("flex-end") || line.includes("center")) {
                expect(line).toContain("X");

                expect(line).toContain("Y");
            }
        });
    });

    it("should match snapshot", () => {
        expect.assertions(1);

        const output = renderTest(<JustifyContent />, { columns: 40 });

        expect(output).toMatchSnapshot();
    });
});

describe("ink compatibility - counter", () => {
    const Counter = () => {
        const [counter] = useState(0);

        return (
            <Text color="green">
                {counter}
                {" "}
                tests passed
            </Text>
        );
    };

    it("should render initial counter value", () => {
        expect.assertions(1);

        const output = renderTest(<Counter />);

        expect(output).toContain("0 tests passed");
    });
});

describe("ink compatibility - chat", () => {
    const ChatApp = () => {
        const [input] = useState("");
        const [messages] = useState<{ id: number; text: string }[]>([]);

        return (
            <Box flexDirection="column" padding={1}>
                <Box flexDirection="column">
                    {messages.map((message) => (
                        <Text key={message.id}>{message.text}</Text>
                    ))}
                </Box>
                <Box marginTop={1}>
                    <Text>
                        Enter your message:
                        {input}
                    </Text>
                </Box>
            </Box>
        );
    };

    it("should render empty chat with input prompt", () => {
        expect.assertions(1);

        const output = renderTest(<ChatApp />);

        expect(output).toContain("Enter your message:");
    });

    it("should match snapshot", () => {
        expect.assertions(1);

        const output = renderTest(<ChatApp />);

        expect(output).toMatchSnapshot();
    });
});

describe("ink compatibility - static component", () => {
    const StaticExample = () => {
        const tests = [
            { id: 0, title: "Test #1" },
            { id: 1, title: "Test #2" },
            { id: 2, title: "Test #3" },
        ];

        return (
            <>
                <Static items={tests}>
                    {(test) => (
                        <Box key={test.id}>
                            <Text color="green">
                                ✔
                                {test.title}
                            </Text>
                        </Box>
                    )}
                </Static>
                <Box marginTop={1}>
                    <Text dimColor>
                        Completed tests:
                        {tests.length}
                    </Text>
                </Box>
            </>
        );
    };

    it("should render static items and dynamic footer", () => {
        expect.assertions(4);

        const output = renderTest(<StaticExample />);

        expect(output).toContain("Test #1");
        expect(output).toContain("Test #2");
        expect(output).toContain("Test #3");
        expect(output).toContain("Completed tests:3");
    });

    it("should match snapshot", () => {
        expect.assertions(1);

        const output = renderTest(<StaticExample />);

        expect(output).toMatchSnapshot();
    });
});

describe("ink compatibility - suspense", () => {
    const Fallback = () => <Text>Loading...</Text>;

    it("should render suspense fallback", () => {
        expect.assertions(1);

        // Component that always suspends
        let thrown = false;

        const AlwaysSuspends = () => {
            if (!thrown) {
                thrown = true;
                suspendForever();
            }

            return <Text>Loaded</Text>;
        };

        const output = renderTest(
            <Suspense fallback={<Fallback />}>
                <AlwaysSuspends />
            </Suspense>,
        );

        expect(output).toContain("Loading...");
    });
});

describe("ink compatibility - concurrent-suspense", () => {
    it("should render suspense fallbacks for multiple boundaries", () => {
        expect.assertions(3);

        const Loading = ({ message }: { message: string }) => (
            <Box marginLeft={2}>
                <Text color="yellow">{message}</Text>
            </Box>
        );

        // All components suspend — we see fallbacks
        const AlwaysSuspends = (): never => suspendForever();

        const output = renderTest(
            <Box flexDirection="column">
                <Text bold underline>
                    Concurrent Suspense Demo
                </Text>
                <Suspense fallback={<Loading message="Loading fast data..." />}>
                    <AlwaysSuspends />
                </Suspense>
                <Suspense fallback={<Loading message="Loading slow data..." />}>
                    <AlwaysSuspends />
                </Suspense>
            </Box>,
        );

        expect(output).toContain("Concurrent Suspense Demo");
        expect(output).toContain("Loading fast data...");
        expect(output).toContain("Loading slow data...");
    });
});

describe("ink compatibility - terminal-resize", () => {
    const TerminalResizeExample = () => (
        <Box flexDirection="column" padding={1}>
            <Text bold color="cyan">
                Terminal Size
            </Text>
            <Text>Columns: 80</Text>
            <Text>Rows: 24</Text>
        </Box>
    );

    it("should render terminal dimension labels", () => {
        expect.assertions(3);

        const output = renderTest(<TerminalResizeExample />);

        expect(output).toContain("Terminal Size");
        expect(output).toContain("Columns: 80");
        expect(output).toContain("Rows: 24");
    });

    it("should match snapshot", () => {
        expect.assertions(1);

        const output = renderTest(<TerminalResizeExample />);

        expect(output).toMatchSnapshot();
    });
});

describe("ink compatibility - use-input", () => {
    const Robot = () => {
        const [x] = useState(1);
        const [y] = useState(1);

        return (
            <Box flexDirection="column">
                <Text>
                    Use arrow keys to move the face. Press
                    {" "}
                    {"\""}
                    q
                    {"\""}
                    {" "}
                    to exit.
                </Text>
                <Box height={12} paddingLeft={x} paddingTop={y}>
                    <Text>^_^</Text>
                </Box>
            </Box>
        );
    };

    it("should render initial state", () => {
        expect.assertions(2);

        const output = renderTest(<Robot />, { columns: 60, rows: 20 });

        expect(output).toContain("Use arrow keys to move the face");
        expect(output).toContain("^_^");
    });

    it("should match snapshot", () => {
        expect.assertions(1);

        const output = renderTest(<Robot />, { columns: 60, rows: 20 });

        expect(output).toMatchSnapshot();
    });
});

describe("ink compatibility - use-focus", () => {
    const Item = ({ label }: { label: string }) => {
        const { isFocused } = useFocus();

        return (
            <Text>
                {label}
                {" "}
                {isFocused && <Text color="green">(focused)</Text>}
            </Text>
        );
    };

    const FocusExample = () => (
        <Box flexDirection="column" padding={1}>
            <Box marginBottom={1}>
                <Text>Press Tab to focus next element</Text>
            </Box>
            <Item label="First" />
            <Item label="Second" />
            <Item label="Third" />
        </Box>
    );

    it("should render all items", () => {
        expect.assertions(4);

        const output = renderTest(<FocusExample />);

        expect(output).toContain("First");
        expect(output).toContain("Second");
        expect(output).toContain("Third");
        expect(output).toContain("Press Tab to focus next element");
    });

    it("should match snapshot", () => {
        expect.assertions(1);

        const output = renderTest(<FocusExample />);

        expect(output).toMatchSnapshot();
    });
});

describe("ink compatibility - use-focus-with-id", () => {
    const Item = ({ id, label }: { id: string; label: string }) => {
        const { isFocused } = useFocus({ id });

        return (
            <Text>
                {label}
                {" "}
                {isFocused && <Text color="green">(focused)</Text>}
            </Text>
        );
    };

    const FocusWithId = () => (
        <Box flexDirection="column" padding={1}>
            <Box marginBottom={1}>
                <Text>Press 1/2/3 to focus by ID</Text>
            </Box>
            <Item id="1" label="Press 1 to focus" />
            <Item id="2" label="Press 2 to focus" />
            <Item id="3" label="Press 3 to focus" />
        </Box>
    );

    it("should render all items with labels", () => {
        expect.assertions(3);

        const output = renderTest(<FocusWithId />);

        expect(output).toContain("Press 1 to focus");
        expect(output).toContain("Press 2 to focus");
        expect(output).toContain("Press 3 to focus");
    });

    it("should match snapshot", () => {
        expect.assertions(1);

        const output = renderTest(<FocusWithId />);

        expect(output).toMatchSnapshot();
    });
});

describe("ink compatibility - use-stderr", () => {
    const StderrExample = () => {
        useStderr();

        // write is a no-op in renderToString
        return <Text>Hello World (check stderr for output)</Text>;
    };

    it("should render without throwing", () => {
        expect.assertions(1);

        const output = renderTest(<StderrExample />);

        expect(output).toContain("Hello World");
    });
});

describe("ink compatibility - use-stdout", () => {
    const StdoutExample = () => {
        const { stdout } = useStdout();

        return (
            <Box flexDirection="column" paddingX={2} paddingY={1}>
                <Text bold underline>
                    Terminal dimensions:
                </Text>
                <Box marginTop={1}>
                    <Text>
                        Width: <Text bold>{stdout.columns}</Text>
                    </Text>
                </Box>
                <Box>
                    <Text>
                        Height: <Text bold>{stdout.rows}</Text>
                    </Text>
                </Box>
            </Box>
        );
    };

    it("should render terminal dimension labels", () => {
        expect.assertions(3);

        const output = renderTest(<StdoutExample />);

        expect(output).toContain("Terminal dimensions:");
        expect(output).toContain("Width:");
        expect(output).toContain("Height:");
    });

    it("should match snapshot", () => {
        expect.assertions(1);

        const output = renderTest(<StdoutExample />);

        expect(output).toMatchSnapshot();
    });
});

describe("ink compatibility - use-transition", () => {
    const SearchApp = () => {
        const [query] = useState("");

        useTransition();
        useState("");

        const fruits = ["Apple", "Banana", "Cherry", "Date", "Elderberry"];
        const items = Array.from({ length: 10 }, (_, i) => `Item ${String(i + 1)}: ${String(fruits[i % 5])}`);

        return (
            <Box flexDirection="column">
                <Text bold underline>
                    useTransition Demo
                </Text>
                <Box>
                    <Text>Search: </Text>
                    <Text color="cyan">{query || "(type something)"}</Text>
                </Box>
                <Box flexDirection="column" marginTop={1}>
                    <Text bold>Results (showing first 10):</Text>
                    {items.map((item) => (
                        <Text key={item}>{item}</Text>
                    ))}
                </Box>
            </Box>
        );
    };

    it("should render initial state with items", () => {
        expect.assertions(4);

        const output = renderTest(<SearchApp />);

        expect(output).toContain("useTransition Demo");
        expect(output).toContain("(type something)");
        expect(output).toContain("Item 1: Apple");
        expect(output).toContain("Item 5: Elderberry");
    });

    it("should match snapshot", () => {
        expect.assertions(1);

        const output = renderTest(<SearchApp />);

        expect(output).toMatchSnapshot();
    });
});

describe("ink compatibility - aria", () => {
    const AriaExample = () => {
        const [checked] = useState(false);

        return (
            <Box flexDirection="column">
                <Text>Press spacebar to toggle the checkbox.</Text>
                <Box marginTop={1}>
                    <Box aria-role="checkbox" aria-state={{ checked }}>
                        <Text>{checked ? "[x]" : "[ ]"}</Text>
                    </Box>
                </Box>
                <Box marginTop={1}>
                    <Text aria-hidden="true">This text is hidden from screen readers.</Text>
                </Box>
            </Box>
        );
    };

    it("should render unchecked checkbox", () => {
        expect.assertions(3);

        const output = renderTest(<AriaExample />);

        expect(output).toContain("[ ]");
        expect(output).toContain("Press spacebar to toggle");
        expect(output).toContain("hidden from screen readers");
    });

    it("should match snapshot", () => {
        expect.assertions(1);

        const output = renderTest(<AriaExample />);

        expect(output).toMatchSnapshot();
    });
});

describe("ink compatibility - cursor-ime", () => {
    const CursorApp = () => {
        const [text] = useState("");

        return (
            <Box flexDirection="column">
                <Text>Type Korean (Ctrl+C to exit):</Text>
                <Text>
                    {">"}
                    {" "}
                    {text}
                </Text>
            </Box>
        );
    };

    it("should render input prompt", () => {
        expect.assertions(2);

        const output = renderTest(<CursorApp />);

        expect(output).toContain("Type Korean");
        expect(output).toContain(">");
    });
});

describe("ink compatibility - spacer", () => {
    const SpacerExample = () => (
        <Box width={40}>
            <Text>Left</Text>
            <Spacer />
            <Text>Right</Text>
        </Box>
    );

    it("should push elements apart", () => {
        expect.assertions(3);

        const output = renderTest(<SpacerExample />, { columns: 40 });
        const line = output.split("\n")[0] ?? "";

        expect(line).toContain("Left");
        expect(line).toContain("Right");
        // Right should be pushed to the far end
        expect(line.indexOf("Left")).toBeLessThan(line.indexOf("Right"));
    });

    it("should match snapshot", () => {
        expect.assertions(1);

        const output = renderTest(<SpacerExample />, { columns: 40 });

        expect(output).toMatchSnapshot();
    });
});

describe("ink compatibility - newline", () => {
    const NewlineExample = () => (
        <Box flexDirection="column">
            <Text>
                Line 1
                <Newline />
                Line 2
            </Text>
        </Box>
    );

    it("should render text on separate lines", () => {
        expect.assertions(2);

        const output = renderTest(<NewlineExample />);

        expect(output).toContain("Line 1");
        expect(output).toContain("Line 2");
    });
});

describe("ink compatibility - text styles", () => {
    it("should render bold text", () => {
        expect.assertions(1);

        const output = renderTest(<Text bold>Bold text</Text>);

        expect(output).toContain("Bold text");
    });

    it("should render italic text", () => {
        expect.assertions(1);

        const output = renderTest(<Text italic>Italic text</Text>);

        expect(output).toContain("Italic text");
    });

    it("should render underline text", () => {
        expect.assertions(1);

        const output = renderTest(<Text underline>Underlined text</Text>);

        expect(output).toContain("Underlined text");
    });

    it("should render dim text", () => {
        expect.assertions(1);

        const output = renderTest(<Text dimColor>Dim text</Text>);

        expect(output).toContain("Dim text");
    });

    it("should render colored text", () => {
        expect.assertions(1);

        const output = renderTest(<Text color="green">Green text</Text>);

        expect(output).toContain("Green text");
    });
});

describe("ink compatibility - nested boxes", () => {
    it("should render nested flex layouts", () => {
        expect.assertions(3);

        const output = renderTest(
            <Box flexDirection="column">
                <Box flexDirection="row">
                    <Box borderStyle="single" marginRight={1}>
                        <Text>A</Text>
                    </Box>
                    <Box borderStyle="single">
                        <Text>B</Text>
                    </Box>
                </Box>
                <Box marginTop={1}>
                    <Text>Below</Text>
                </Box>
            </Box>,
            { columns: 30 },
        );

        expect(output).toContain("A");
        expect(output).toContain("B");
        expect(output).toContain("Below");
    });

    it("should match snapshot", () => {
        expect.assertions(1);

        const output = renderTest(
            <Box flexDirection="column">
                <Box flexDirection="row">
                    <Box borderStyle="single" marginRight={1}>
                        <Text>A</Text>
                    </Box>
                    <Box borderStyle="single">
                        <Text>B</Text>
                    </Box>
                </Box>
                <Box marginTop={1}>
                    <Text>Below</Text>
                </Box>
            </Box>,
            { columns: 30 },
        );

        expect(output).toMatchSnapshot();
    });
});

describe("ink compatibility - incremental-rendering", () => {
    const IncrementalRendering = () => {
        const [selectedIndex] = useState(0);
        const services = ["Server Authentication Module", "Database Connection Pool", "API Gateway Service"];

        return (
            <Box flexDirection="column">
                <Box borderColor="cyan" borderStyle="round" paddingX={2} paddingY={1}>
                    <Text bold color="cyan">
                        Incremental Rendering Demo
                    </Text>
                </Box>
                <Box borderColor="gray" borderStyle="single" flexDirection="column" marginTop={1} paddingX={2} paddingY={1}>
                    {services.map((svc, index) => (
                        <Text color={index === selectedIndex ? "blue" : "white"} key={svc}>
                            {index === selectedIndex ? "> " : "  "}
                            {svc}
                        </Text>
                    ))}
                </Box>
            </Box>
        );
    };

    it("should render service list with selection indicator", () => {
        expect.assertions(4);

        const output = renderTest(<IncrementalRendering />, { columns: 60 });

        expect(output).toContain("Incremental Rendering Demo");
        expect(output).toContain("Server Authentication Module");
        expect(output).toContain("Database Connection Pool");
        expect(output).toContain("API Gateway Service");
    });

    it("should match snapshot", () => {
        expect.assertions(1);

        const output = renderTest(<IncrementalRendering />, { columns: 60 });

        expect(output).toMatchSnapshot();
    });
});

describe("ink compatibility - stress-test", () => {
    const COLORS = ["red", "green", "yellow", "blue", "magenta", "cyan", "white"] as const;
    const CHARS = ["█", "▓", "▒", "░", "▪", "▫", "●", "○", "◆", "◇"];

    const GridRow = ({ cols, frame, y }: { cols: number; frame: number; y: number }) => {
        const cells: React.ReactElement[] = [];

        for (let x = 0; x < cols; x += 1) {
            const colorIndex = (x + y + frame) % COLORS.length;
            const charIndex = (x * 3 + y * 7 + frame) % CHARS.length;

            cells.push(
                <Text color={COLORS[colorIndex]} key={x}>
                    {CHARS[charIndex]}
                </Text>,
            );
        }

        return <Box>{cells}</Box>;
    };

    const StressTest = () => (
        <Box flexDirection="column" height={10} width={20}>
            <Box borderColor="cyan" borderStyle="round" flexShrink={0} marginBottom={1} paddingX={2}>
                <Text bold color="cyan">
                    Stress test
                </Text>
            </Box>
            <Box flexDirection="column" flexGrow={1}>
                {Array.from({ length: 5 }, (_, y) => (
                    <GridRow cols={20} frame={0} key={y} y={y} />
                ))}
            </Box>
        </Box>
    );

    it("should render grid cells", () => {
        expect.assertions(2);

        const output = renderTest(<StressTest />, { columns: 20, rows: 10 });

        expect(output).toContain("Stress test");
        // Grid cells should contain block characters
        expect(output).toMatch(BLOCK_CHARS_RE);
    });

    it("should match snapshot", () => {
        expect.assertions(1);

        const output = renderTest(<StressTest />, { columns: 20, rows: 10 });

        expect(output).toMatchSnapshot();
    });
});
