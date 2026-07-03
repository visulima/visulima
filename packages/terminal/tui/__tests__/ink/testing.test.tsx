import React from "react";
import { afterEach, describe, expect, expectTypeOf, it } from "vitest";

import Box from "../../src/components/box";
import Text from "../../src/components/text";
import { cleanup, render } from "../../src/testing/index";

afterEach(() => {
    cleanup();
});

describe("testing library", () => {
    it("should render a basic component and capture output", () => {
        expect.assertions(1);

        const { lastFrame } = render(<Text>Hello World</Text>);

        expect(lastFrame()).toBe("Hello World");
    });

    it("should capture all frames", () => {
        expect.assertions(3);

        const { frames, rerender } = render(<Text>Frame 1</Text>);

        rerender(<Text>Frame 2</Text>);

        expect(frames.length).toBeGreaterThanOrEqual(2);
        expect(frames[0]).toBe("Frame 1");
        expect(frames.at(-1)).toBe("Frame 2");
    });

    it("should support rerender with new props", () => {
        expect.assertions(2);

        const Counter = ({ count }: { count: number }) => <Text>Count: {count}</Text>;

        const { lastFrame, rerender } = render(<Counter count={0} />);

        expect(lastFrame()).toBe("Count: 0");

        rerender(<Counter count={1} />);

        expect(lastFrame()).toBe("Count: 1");
    });

    it("should support unmount", () => {
        expect.assertions(2);

        const { lastFrame, unmount } = render(<Text>Test</Text>);

        expect(lastFrame()).toBe("Test");

        unmount();

        // After unmount, ink renders a final empty frame
        expect(lastFrame()).toBe("\n");
    });

    // eslint-disable-next-line vitest/prefer-expect-assertions -- smoke test; verifies no throw
    it("should support cleanup", () => {
        render(<Text>Test 1</Text>);
        render(<Text>Test 2</Text>);

        // cleanup() is called in afterEach, but we can also call it explicitly
        cleanup();
    });

    it("should support custom column width", () => {
        expect.assertions(1);

        const WideComponent = () => (
            <Box width="100%">
                <Text>Full width</Text>
            </Box>
        );

        const { stdout } = render(<WideComponent />, { columns: 50 });

        expect(stdout.frames.length).toBeGreaterThan(0);
    });

    it("should expose stdout frames and lastFrame", () => {
        expect.assertions(3);

        const { rerender, stdout } = render(<Text>first</Text>);

        expect(stdout.lastFrame()).toBe("first");

        rerender(<Text>second</Text>);

        expect(stdout.frames.length).toBeGreaterThanOrEqual(2);
        expect(stdout.lastFrame()).toBe("second");
    });

    it("should expose stderr stream", () => {
        expect.assertions(2);

        const { stderr } = render(<Text>Hello</Text>);

        // stderr exists and has the testing API
        expect(stderr).toBeDefined();

        expectTypeOf(stderr.lastFrame).toBeFunction();
        expectTypeOf(stderr.write).toBeFunction();

        expect(stderr.frames).toBeDefined();
    });

    it("should expose stdin stream for writing input", () => {
        expect.assertions(2);

        const { stdin } = render(<Text>Hello</Text>);

        // stdin exists and has the testing API
        expect(stdin).toBeDefined();
        expect(stdin.isTTY).toBe(true);

        expectTypeOf(stdin.write).toBeFunction();
    });

    it("should cleanup all instances when calling module-level cleanup", () => {
        expect.assertions(2);

        const instance1 = render(<Text>One</Text>);
        const instance2 = render(<Text>Two</Text>);

        expect(instance1.lastFrame()).toBe("One");
        expect(instance2.lastFrame()).toBe("Two");

        cleanup();
    });

    it("should render nested components", () => {
        expect.assertions(1);

        const { lastFrame } = render(
            <Box>
                <Text>Hello </Text>
                <Text>World</Text>
            </Box>,
        );

        expect(lastFrame()).toBe("Hello World");
    });

    it("should render with box layout", () => {
        expect.assertions(2);

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
