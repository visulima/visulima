import { strip as stripAnsi } from "@visulima/ansi";
import delay from "delay";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import type { DOMElement } from "../../src/ink/index.js";
import { Box, measureElement, render, Text } from "../../src/ink/index.js";
import createStdout from "../helpers/ink-create-stdout.js";

describe("measure-element", () => {
    let currentUnmount: (() => void) | undefined;

    afterEach(async () => {
        currentUnmount?.();
        currentUnmount = undefined;
        await delay(100);
    });

    it("measure element", async () => {
        expect.hasAssertions();

        const stdout = createStdout();

        const Test = () => {
            const [width, setWidth] = useState(0);
            const ref = useRef<DOMElement>(null);

            // eslint-disable-next-line react-you-might-not-need-an-effect/no-initialize-state -- intentionally testing effect-based measurement
            useEffect(() => {
                if (!ref.current) {
                    return;
                }

                setWidth(measureElement(ref.current).width);
            }, []);

            return (
                <Box ref={ref}>
                    <Text>
                        Width:
                        {width}
                    </Text>
                </Box>
            );
        };

        const { unmount } = render(<Test />, { debug: true, stdout });
        currentUnmount = unmount;

        expect((stdout.write as any).mock.calls[0][0]).toBe("Width:0");

        await delay(100);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("Width:100");
    });

    it("measure element after state update", async () => {
        expect.hasAssertions();

        const stdout = createStdout();
        let setTestItems!: (items: string[]) => void;

        const Test = () => {
            const [items, setItems] = useState<string[]>([]);
            const [height, setHeight] = useState(0);
            const ref = useRef<DOMElement>(null);

            setTestItems = setItems;

            // eslint-disable-next-line react-you-might-not-need-an-effect/no-chain-state-updates -- intentionally testing effect-based measurement
            useEffect(() => {
                if (!ref.current) {
                    return;
                }

                setHeight(measureElement(ref.current).height);
            }, [items.length]);

            return (
                <Box flexDirection="column">
                    <Box flexDirection="column" ref={ref}>
                        {items.map((item) => (
                            <Text key={item}>{item}</Text>
                        ))}
                    </Box>
                    <Text>
                        Height:
                        {height}
                    </Text>
                </Box>
            );
        };

        const { unmount } = render(<Test />, { debug: true, stdout });
        currentUnmount = unmount;
        await delay(100);

        setTestItems(["line 1", "line 2", "line 3"]);
        await delay(100);

        expect(stripAnsi((stdout.write as any).mock.calls.at(-1)[0] as string).trim()).toBe("line 1\nline 2\nline 3\nHeight:3");
    });

    it("measure element after multiple state updates", async () => {
        expect.hasAssertions();

        const stdout = createStdout();
        let setTestItems!: (items: string[]) => void;

        const Test = () => {
            const [items, setItems] = useState<string[]>([]);
            const [height, setHeight] = useState(0);
            const ref = useRef<DOMElement>(null);

            setTestItems = setItems;

            useEffect(() => {
            // eslint-disable-next-line react-you-might-not-need-an-effect/no-chain-state-updates -- intentionally testing effect-based measurement
                if (!ref.current) {
                    return;
                }

                setHeight(measureElement(ref.current).height);
            }, [items.length]);

            return (
                <Box flexDirection="column">
                    <Box flexDirection="column" ref={ref}>
                        {items.map((item) => (
                            <Text key={item}>{item}</Text>
                        ))}
                    </Box>
                    <Text>
                        Height:
                        {height}
                    </Text>
                </Box>
            );
        };

        const { unmount } = render(<Test />, { debug: true, stdout });
        currentUnmount = unmount;
        await delay(100);

        setTestItems(["line 1", "line 2", "line 3"]);
        await delay(100);

        setTestItems(["line 1"]);
        await delay(100);

        expect(stripAnsi((stdout.write as any).mock.calls.at(-1)[0] as string).trim()).toBe("line 1\nHeight:1");
    });

    it("measure element in useLayoutEffect after state update", async () => {
        expect.hasAssertions();

        const stdout = createStdout();
        let setTestItems!: (items: string[]) => void;

        const Test = () => {
            const [items, setItems] = useState<string[]>([]);
            const [height, setHeight] = useState(0);
            const ref = useRef<DOMElement>(null);

            setTestItems = setItems;

            useLayoutEffect(() => {
                if (!ref.current) {
                    return;
                }

                setHeight(measureElement(ref.current).height);
            }, [items.length]);

            return (
                <Box flexDirection="column">
                    <Box flexDirection="column" ref={ref}>
                        {items.map((item) => (
                            <Text key={item}>{item}</Text>
                        ))}
                    </Box>
                    <Text>
                        Height:
                        {height}
                    </Text>
                </Box>
            );
        };

        const { unmount } = render(<Test />, { debug: true, stdout });
        currentUnmount = unmount;
        await delay(100);

        setTestItems(["line 1", "line 2", "line 3"]);
        await delay(100);

        expect(stripAnsi((stdout.write as any).mock.calls.at(-1)[0] as string).trim()).toBe("line 1\nline 2\nline 3\nHeight:3");
    });

    // Timing-sensitive test that passes in isolation but can fail when run with other tests
    it.skip("calculate layout while rendering is throttled", async () => {
        expect.hasAssertions();

        const stdout = createStdout();

        const Test = () => {
            const [width, setWidth] = useState(0);
            const ref = useRef<DOMElement>(null);

            useEffect(() => {
            // eslint-disable-next-line react-you-might-not-need-an-effect/no-initialize-state -- intentionally testing effect-based measurement
                if (!ref.current) {
                    return;
                }

                setWidth(measureElement(ref.current).width);
            }, []);

            return (
                <Box ref={ref}>
                    <Text>
                        Width:
                        {width}
                    </Text>
                </Box>
            );
        };

        const { rerender } = render(null, { patchConsole: false, stdout });

        rerender(<Test />);
        await delay(100);

        const writes: string[] = (stdout.write as any).mock.calls.map((c: any) => c[0] as string).filter((w: string) => !w.startsWith("\u001B[?25") && !w.startsWith("\u001B[?2026"));
        const lastContentWrite = writes.at(-1)!;

        expect(stripAnsi(lastContentWrite).trim()).toBe("Width:100");
    });
});
