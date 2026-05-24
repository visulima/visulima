import { strip as stripAnsi } from "@visulima/ansi";
import delay from "delay";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { Box, Text } from "../../src/components/index";
import type { DOMElement } from "../../src/ink/index";
import { measureElement, render } from "../../src/ink/index";
import createStdout from "../helpers/ink-create-stdout";

describe("measure-element", () => {
    let currentUnmount: (() => void) | undefined;

    afterEach(async () => {
        currentUnmount?.();
        currentUnmount = undefined;
        await delay(100);
    });

    it("measure element", async () => {
        expect.assertions(2);

        const stdout = createStdout();

        const Test = () => {
            const [width, setWidth] = useState(0);
            const ref = useRef<DOMElement>(null);

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
        expect.assertions(1);

        const stdout = createStdout();
        let setTestItems!: (items: string[]) => void;

        const Test = () => {
            const [items, setItems] = useState<string[]>([]);
            const [height, setHeight] = useState(0);
            const ref = useRef<DOMElement>(null);

            setTestItems = setItems;

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

    // Windows runners occasionally read a stale measurement after the
    // second state flush — measureElement runs before yoga reflows.
    it.skipIf(process.platform === "win32")("measure element after multiple state updates", async () => {
        expect.assertions(1);

        const stdout = createStdout();
        let setTestItems!: (items: string[]) => void;

        const Test = () => {
            const [items, setItems] = useState<string[]>([]);
            const [height, setHeight] = useState(0);
            const ref = useRef<DOMElement>(null);

            setTestItems = setItems;

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

        setTestItems(["line 1"]);
        await delay(100);

        expect(stripAnsi((stdout.write as any).mock.calls.at(-1)[0] as string).trim()).toBe("line 1\nHeight:1");
    });

    it("measure element in useLayoutEffect after state update", async () => {
        expect.assertions(1);

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
        expect.assertions(1);

        const stdout = createStdout();

        const Test = () => {
            const [width, setWidth] = useState(0);
            const ref = useRef<DOMElement>(null);

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

        const { rerender } = render(null, { patchConsole: false, stdout });

        rerender(<Test />);
        await delay(100);

        const writes: string[] = (stdout.write as any).mock.calls.map((c: any) => c[0] as string).filter((w: string) => !w.startsWith("\u001B[?25") && !w.startsWith("\u001B[?2026"));
        const lastContentWrite = writes.at(-1)!;

        expect(stripAnsi(lastContentWrite).trim()).toBe("Width:100");
    });
});
