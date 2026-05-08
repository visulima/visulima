import { strip as stripAnsi } from "@visulima/ansi";
import delay from "delay";
import { useRef, useState } from "react";
import { describe, expect, it } from "vitest";

import { Box, Text } from "../../src/components/index";
import { useBoxMetrics } from "../../src/ink/hooks/use-box-metrics";
import type { DOMElement } from "../../src/ink/index";
import { render } from "../../src/ink/index";
import createStdout from "../helpers/ink-create-stdout";
import waitFor from "../helpers/wait-for";

describe("use-box-metrics", () => {
    it("returns correct size on first render", async () => {
        expect.assertions(1);

        const stdout = createStdout(100);

        const Test = () => {
            const ref = useRef<DOMElement>(null);
            const { height, width } = useBoxMetrics(ref);

            return (
                <Box ref={ref}>
                    <Text>
                        {width}
                        x
                        {height}
                    </Text>
                </Box>
            );
        };

        const { waitUntilRenderFlush } = render(<Test />, { debug: true, stdout });

        await waitUntilRenderFlush();
        await delay(50);

        expect(stripAnsi(stdout.get())).toContain("100x1");
    });

    it("returns correct position", async () => {
        expect.assertions(1);

        const stdout = createStdout(100);

        const Test = () => {
            const ref = useRef<DOMElement>(null);
            const { left, top } = useBoxMetrics(ref);

            return (
                <Box flexDirection="column">
                    <Text>first line</Text>
                    <Box marginLeft={5} ref={ref}>
                        <Text>
                            {left}
                            ,
                            {top}
                        </Text>
                    </Box>
                </Box>
            );
        };

        const { waitUntilRenderFlush } = render(<Test />, { debug: true, stdout });

        await waitUntilRenderFlush();
        await delay(50);

        expect(stripAnsi(stdout.get())).toContain("5,1");
    });

    it("updates when terminal is resized", async () => {
        expect.assertions(2);

        const stdout = createStdout(100);

        const Test = () => {
            const ref = useRef<DOMElement>(null);
            const { width } = useBoxMetrics(ref);

            return (
                <Box ref={ref}>
                    <Text>
                        Width:
                        {width}
                    </Text>
                </Box>
            );
        };

        const { waitUntilRenderFlush } = render(<Test />, { debug: true, interactive: true, stdout });

        await waitUntilRenderFlush();
        await delay(50);

        expect(stripAnsi(stdout.get())).toContain("Width:100");

        (stdout as any).columns = 60;
        stdout.emit("resize");
        await waitFor(() => stripAnsi(stdout.get()).includes("Width:60"));

        expect(stripAnsi(stdout.get())).toContain("Width:60");
    });

    it("updates when sibling content changes", async () => {
        expect.assertions(2);

        const stdout = createStdout(100);
        let externalSetSiblingText!: (text: string) => void;

        const Test = () => {
            const ref = useRef<DOMElement>(null);
            const [siblingText, setSiblingText] = useState("short");
            const { height } = useBoxMetrics(ref);

            externalSetSiblingText = setSiblingText;

            return (
                <Box flexDirection="column">
                    <Box flexDirection="column" ref={ref}>
                        <Text>{siblingText}</Text>
                    </Box>
                    <Text>
                        Height:
                        {height}
                    </Text>
                </Box>
            );
        };

        const { waitUntilRenderFlush } = render(<Test />, { debug: true, stdout });

        await waitUntilRenderFlush();
        await delay(50);

        expect(stripAnsi(stdout.get())).toContain("Height:1");

        externalSetSiblingText("line 1\nline 2\nline 3");
        await delay(50);

        expect(stripAnsi(stdout.get())).toContain("Height:3");
    });

    it("does not trigger extra re-renders when layout is unchanged", async () => {
        expect.assertions(2);

        const stdout = createStdout(100);
        let renderCount = 0;

        const Test = () => {
            const ref = useRef<DOMElement>(null);

            useBoxMetrics(ref);
            renderCount += 1;

            return (
                <Box ref={ref}>
                    <Text>Hello</Text>
                </Box>
            );
        };

        const { waitUntilRenderFlush } = render(<Test />, { debug: true, stdout });

        await waitUntilRenderFlush();
        await delay(100);

        expect(renderCount).toBeGreaterThanOrEqual(2);
        expect(renderCount).toBeLessThanOrEqual(3);
    });

    const SimpleBox = () => {
        const ref = useRef<DOMElement>(null);

        useBoxMetrics(ref);

        return (
            <Box ref={ref}>
                <Text>Hello</Text>
            </Box>
        );
    };

    it("removes resize listener on unmount", async () => {
        expect.assertions(2);

        const stdout = createStdout(100);

        const initialListenerCount = stdout.listenerCount("resize");
        const { unmount, waitUntilRenderFlush } = render(<SimpleBox />, { stdout });

        await waitUntilRenderFlush();

        expect(stdout.listenerCount("resize")).toBeGreaterThan(initialListenerCount);

        unmount();

        expect(stdout.listenerCount("resize")).toBe(initialListenerCount);
    });

    it("does not crash when resize fires after unmount", async () => {
        expect.assertions(1);

        const stdout = createStdout(100);

        const { unmount, waitUntilRenderFlush } = render(<SimpleBox />, { stdout });

        await waitUntilRenderFlush();
        unmount();

        stdout.emit("resize");
        await delay(50);

        expect(true).toBe(true); // No crash
    });

    it("returns zeros when ref is not attached", async () => {
        expect.assertions(1);

        const stdout = createStdout(100);

        const Test = () => {
            const ref = useRef<DOMElement>(null);
            const { hasMeasured, height, left, top, width } = useBoxMetrics(ref);

            return (
                <Box>
                    <Text>
                        {width}
                        ,
                        {height}
                        ,
                        {left}
                        ,
                        {top}
                        ,
                        {String(hasMeasured)}
                    </Text>
                </Box>
            );
        };

        const { waitUntilRenderFlush } = render(<Test />, { debug: true, stdout });

        await waitUntilRenderFlush();
        await delay(50);

        expect(stripAnsi(stdout.get())).toContain("0,0,0,0,false");
    });

    it("hasMeasured becomes true when tracked element is mounted on initial render", async () => {
        expect.assertions(1);

        const stdout = createStdout(100);

        const Test = () => {
            const ref = useRef<DOMElement>(null);
            const { hasMeasured } = useBoxMetrics(ref);

            return (
                <Box ref={ref}>
                    <Text>
                        Has measured:
                        {String(hasMeasured)}
                    </Text>
                </Box>
            );
        };

        const { waitUntilRenderFlush } = render(<Test />, { debug: true, stdout });

        await waitUntilRenderFlush();
        await delay(50);

        expect(stripAnsi(stdout.get())).toContain("Has measured:true");
    });

    it("resets metrics when tracked element unmounts", async () => {
        expect.assertions(2);

        const stdout = createStdout(100);
        let unmountTrackedElement!: () => void;

        const Test = () => {
            const ref = useRef<DOMElement>(null);
            const [isTrackedElementMounted, setIsTrackedElementMounted] = useState(true);
            const { hasMeasured, height, left, top, width } = useBoxMetrics(ref);

            unmountTrackedElement = () => {
                setIsTrackedElementMounted(false);
            };

            return (
                <Box flexDirection="column">
                    {isTrackedElementMounted
                        ? (
                            <Box ref={ref} width={10}>
                                <Text>1234567890</Text>
                            </Box>
                        )
                        : undefined}
                    <Text>
                        Metrics: {width},{height},{left},{top},{String(hasMeasured)}
                    </Text>
                </Box>
            );
        };

        const { waitUntilRenderFlush } = render(<Test />, { debug: true, stdout });

        await waitUntilRenderFlush();
        await delay(50);

        expect(stripAnsi(stdout.get())).toContain("Metrics: 10,1,0,0,true");

        unmountTrackedElement();
        await waitUntilRenderFlush();
        await delay(50);

        expect(stripAnsi(stdout.get())).toContain("Metrics: 0,0,0,0,false");
    });
});
