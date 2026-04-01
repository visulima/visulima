import React from "react";

import { describe, expect, it, afterEach } from "vitest";

import Box from "../../src/ink/components/Box";
import Text from "../../src/ink/components/Text";
import { cleanup, render } from "../../src/testing/index";

afterEach(() => {
    cleanup();
});

describe("testing library", () => {
    it("should render a basic component and capture output", () => {
        const { lastFrame } = render(<Text>Hello World</Text>);

        expect(lastFrame()).toBe("Hello World");
    });

    it("should capture all frames", () => {
        const { frames, rerender } = render(<Text>Frame 1</Text>);

        rerender(<Text>Frame 2</Text>);

        expect(frames.length).toBeGreaterThanOrEqual(2);
        expect(frames[0]).toBe("Frame 1");
        expect(frames.at(-1)).toBe("Frame 2");
    });

    it("should support rerender with new props", () => {
        const Counter = ({ count }: { count: number }) => <Text>Count: {count}</Text>;

        const { lastFrame, rerender } = render(<Counter count={0} />);

        expect(lastFrame()).toBe("Count: 0");

        rerender(<Counter count={1} />);

        expect(lastFrame()).toBe("Count: 1");
    });

    it("should support unmount", () => {
        const { unmount, lastFrame } = render(<Text>Test</Text>);

        expect(lastFrame()).toBe("Test");

        unmount();

        // After unmount, ink renders a final empty frame
        expect(lastFrame()).toBe("\n");
    });

    it("should support cleanup", () => {
        render(<Text>Test 1</Text>);
        render(<Text>Test 2</Text>);

        // cleanup() is called in afterEach, but we can also call it explicitly
        cleanup();
    });

    it("should support custom column width", () => {
        const WideComponent = () => (
            <Box width="100%">
                <Text>Full width</Text>
            </Box>
        );

        const { stdout } = render(<WideComponent />, { columns: 50 });

        expect(stdout.frames.length).toBeGreaterThan(0);
    });

    it("should expose stdout frames and lastFrame", () => {
        const { stdout, rerender } = render(<Text>first</Text>);

        expect(stdout.lastFrame()).toBe("first");

        rerender(<Text>second</Text>);

        expect(stdout.frames.length).toBeGreaterThanOrEqual(2);
        expect(stdout.lastFrame()).toBe("second");
    });

    it("should expose stderr stream", () => {
        const { stderr } = render(<Text>Hello</Text>);

        // stderr exists and has the testing API
        expect(stderr).toBeDefined();
        expect(typeof stderr.lastFrame).toBe("function");
        expect(typeof stderr.write).toBe("function");
        expect(stderr.frames).toBeDefined();
    });

    it("should expose stdin stream for writing input", () => {
        const { stdin } = render(<Text>Hello</Text>);

        // stdin exists and has the testing API
        expect(stdin).toBeDefined();
        expect(stdin.isTTY).toBe(true);
        expect(typeof stdin.write).toBe("function");
    });

    it("should cleanup all instances when calling module-level cleanup", () => {
        const instance1 = render(<Text>One</Text>);
        const instance2 = render(<Text>Two</Text>);

        expect(instance1.lastFrame()).toBe("One");
        expect(instance2.lastFrame()).toBe("Two");

        cleanup();
    });

    it("should render nested components", () => {
        const { lastFrame } = render(
            <Box>
                <Text>Hello </Text>
                <Text>World</Text>
            </Box>,
        );

        expect(lastFrame()).toBe("Hello World");
    });

    it("should render with box layout", () => {
        const { lastFrame } = render(
            <Box flexDirection="column">
                <Text>Line 1</Text>
                <Text>Line 2</Text>
            </Box>,
        );

        expect(lastFrame()).toContain("Line 1");
        expect(lastFrame()).toContain("Line 2");
    });
});
