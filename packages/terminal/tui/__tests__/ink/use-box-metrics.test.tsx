import { useRef, useState } from "react";
import { describe, expect, it } from "vitest";
import delay from "delay";
import stripAnsi from "strip-ansi";
import { Box, Text, render, useBoxMetrics, type DOMElement } from "../../src/ink/index.js";
import createStdout from "../helpers/ink-create-stdout.js";

it("returns correct size on first render", async () => {
    const stdout = createStdout(100);

    function Test() {
        const ref = useRef<DOMElement>(null);
        const { width, height } = useBoxMetrics(ref);
        return (
            <Box ref={ref}>
                <Text>
                    {width}x{height}
                </Text>
            </Box>
        );
    }

    const { waitUntilRenderFlush } = render(<Test />, { stdout, debug: true });
    await waitUntilRenderFlush();
    await delay(50);

    expect(stripAnsi(stdout.get()).includes("100x1")).toBe(true);
});

it("returns correct position", async () => {
    const stdout = createStdout(100);

    function Test() {
        const ref = useRef<DOMElement>(null);
        const { left, top } = useBoxMetrics(ref);
        return (
            <Box flexDirection="column">
                <Text>first line</Text>
                <Box ref={ref} marginLeft={5}>
                    <Text>
                        {left},{top}
                    </Text>
                </Box>
            </Box>
        );
    }

    const { waitUntilRenderFlush } = render(<Test />, { stdout, debug: true });
    await waitUntilRenderFlush();
    await delay(50);

    expect(stripAnsi(stdout.get()).includes("5,1")).toBe(true);
});

it("updates when terminal is resized", async () => {
    const stdout = createStdout(100);

    function Test() {
        const ref = useRef<DOMElement>(null);
        const { width } = useBoxMetrics(ref);
        return (
            <Box ref={ref}>
                <Text>Width: {width}</Text>
            </Box>
        );
    }

    const { waitUntilRenderFlush } = render(<Test />, { stdout, debug: true });
    await waitUntilRenderFlush();
    await delay(50);

    expect(stripAnsi(stdout.get()).includes("Width: 100")).toBe(true);

    (stdout as any).columns = 60;
    stdout.emit("resize");
    await delay(200);

    expect(stripAnsi(stdout.get()).includes("Width: 60")).toBe(true);
});

it("updates when sibling content changes", async () => {
    const stdout = createStdout(100);
    let externalSetSiblingText!: (text: string) => void;

    function Test() {
        const ref = useRef<DOMElement>(null);
        const [siblingText, setSiblingText] = useState("short");
        const { height } = useBoxMetrics(ref);

        externalSetSiblingText = setSiblingText;

        return (
            <Box flexDirection="column">
                <Box ref={ref} flexDirection="column">
                    <Text>{siblingText}</Text>
                </Box>
                <Text>Height: {height}</Text>
            </Box>
        );
    }

    const { waitUntilRenderFlush } = render(<Test />, { stdout, debug: true });
    await waitUntilRenderFlush();
    await delay(50);

    expect(stripAnsi(stdout.get()).includes("Height: 1")).toBe(true);

    externalSetSiblingText("line 1\nline 2\nline 3");
    await delay(50);

    expect(stripAnsi(stdout.get()).includes("Height: 3")).toBe(true);
});

it("does not trigger extra re-renders when layout is unchanged", async () => {
    const stdout = createStdout(100);
    let renderCount = 0;

    function Test() {
        const ref = useRef<DOMElement>(null);
        useBoxMetrics(ref);
        renderCount++;
        return (
            <Box ref={ref}>
                <Text>Hello</Text>
            </Box>
        );
    }

    const { waitUntilRenderFlush } = render(<Test />, { stdout, debug: true });
    await waitUntilRenderFlush();
    await delay(100);

    expect(renderCount).toBeGreaterThanOrEqual(2);
    expect(renderCount).toBeLessThanOrEqual(3);
});

function SimpleBox() {
    const ref = useRef<DOMElement>(null);
    useBoxMetrics(ref);
    return (
        <Box ref={ref}>
            <Text>Hello</Text>
        </Box>
    );
}

it("removes resize listener on unmount", async () => {
    const stdout = createStdout(100);

    const initialListenerCount = stdout.listenerCount("resize");
    const { unmount, waitUntilRenderFlush } = render(<SimpleBox />, { stdout });
    await waitUntilRenderFlush();

    expect(stdout.listenerCount("resize")).toBeGreaterThan(initialListenerCount);
    unmount();

    expect(stdout.listenerCount("resize")).toBe(initialListenerCount);
});

it("does not crash when resize fires after unmount", async () => {
    const stdout = createStdout(100);

    const { unmount, waitUntilRenderFlush } = render(<SimpleBox />, { stdout });
    await waitUntilRenderFlush();
    unmount();

    stdout.emit("resize");
    await delay(50);

    expect(true).toBe(true); // No crash
});

it("returns zeros when ref is not attached", async () => {
    const stdout = createStdout(100);

    function Test() {
        const ref = useRef<DOMElement>(null);
        const { width, height, left, top, hasMeasured } = useBoxMetrics(ref);
        return (
            <Box>
                <Text>
                    {width},{height},{left},{top},{String(hasMeasured)}
                </Text>
            </Box>
        );
    }

    const { waitUntilRenderFlush } = render(<Test />, { stdout, debug: true });
    await waitUntilRenderFlush();
    await delay(50);

    expect(stripAnsi(stdout.get()).includes("0,0,0,0,false")).toBe(true);
});

it("hasMeasured becomes true when tracked element is mounted on initial render", async () => {
    const stdout = createStdout(100);

    function Test() {
        const ref = useRef<DOMElement>(null);
        const { hasMeasured } = useBoxMetrics(ref);

        return (
            <Box ref={ref}>
                <Text>Has measured: {String(hasMeasured)}</Text>
            </Box>
        );
    }

    const { waitUntilRenderFlush } = render(<Test />, { stdout, debug: true });
    await waitUntilRenderFlush();
    await delay(50);

    expect(stripAnsi(stdout.get()).includes("Has measured: true")).toBe(true);
});

it("resets metrics when tracked element unmounts", async () => {
    const stdout = createStdout(100);
    let unmountTrackedElement!: () => void;

    function Test() {
        const ref = useRef<DOMElement>(null);
        const [isTrackedElementMounted, setIsTrackedElementMounted] = useState(true);
        const { width, height, left, top, hasMeasured } = useBoxMetrics(ref);

        unmountTrackedElement = () => {
            setIsTrackedElementMounted(false);
        };

        return (
            <Box flexDirection="column">
                {isTrackedElementMounted ? (
                    <Box ref={ref} width={10}>
                        <Text>1234567890</Text>
                    </Box>
                ) : undefined}
                <Text>
                    Metrics: {width},{height},{left},{top},{String(hasMeasured)}
                </Text>
            </Box>
        );
    }

    const { waitUntilRenderFlush } = render(<Test />, { stdout, debug: true });
    await waitUntilRenderFlush();
    await delay(50);

    expect(stripAnsi(stdout.get()).includes("Metrics: 10,1,0,0,true")).toBe(true);

    unmountTrackedElement();
    await waitUntilRenderFlush();
    await delay(50);

    expect(stripAnsi(stdout.get()).includes("Metrics: 0,0,0,0,false")).toBe(true);
});
