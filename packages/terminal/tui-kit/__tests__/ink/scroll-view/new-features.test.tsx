import Box from "@visulima/tui/components/box";
import Text from "@visulima/tui/components/text";
import { cleanup, render } from "@visulima/tui/test";
import React, { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ScrollViewRef } from "../../../src/scroll/scroll-view";
import { ScrollView } from "../../../src/scroll/scroll-view";

afterEach(() => {
    cleanup();
});

const delay = (ms: number) =>
    new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });

const Item = ({ height = 1, label }: { height?: number; label: string }) => (
    <Box height={height}>
        <Text>{label}</Text>
    </Box>
);

describe("scrollView - onReachEnd / onReachStart", () => {
    it("should fire onReachEnd when near bottom", async () => {
        expect.assertions(1);

        const onReachEnd = vi.fn();
        const scrollRef = React.createRef<ScrollViewRef>();

        render(
            <Box height={5}>
                <ScrollView height={5} onReachEnd={onReachEnd} reachThreshold={2} ref={scrollRef}>
                    {Array.from({ length: 20 }, (_, i) => (
                        <Item key={i} label={`Line ${i}`} />
                    ))}
                </ScrollView>
            </Box>,
        );

        await delay(50);

        // Scroll near the end
        scrollRef.current?.scrollTo(13);
        await delay(50);

        expect(onReachEnd).toHaveBeenCalledTimes(1);
    });

    it("should fire onReachStart when scrolling back near top", async () => {
        expect.assertions(2);

        const onReachStart = vi.fn();
        const scrollRef = React.createRef<ScrollViewRef>();

        render(
            <Box height={5}>
                <ScrollView height={5} onReachStart={onReachStart} reachThreshold={2} ref={scrollRef}>
                    {Array.from({ length: 20 }, (_, i) => (
                        <Item key={i} label={`Line ${i}`} />
                    ))}
                </ScrollView>
            </Box>,
        );

        await delay(50);

        // Scroll away from top first
        scrollRef.current?.scrollTo(10);
        await delay(50);

        expect(onReachStart).not.toHaveBeenCalled();

        // Scroll back near top
        scrollRef.current?.scrollTo(1);
        await delay(50);

        expect(onReachStart).toHaveBeenCalledTimes(1);
    });

    it("should not fire onReachEnd repeatedly while in threshold zone", async () => {
        expect.assertions(1);

        const onReachEnd = vi.fn();
        const scrollRef = React.createRef<ScrollViewRef>();

        render(
            <Box height={5}>
                <ScrollView height={5} onReachEnd={onReachEnd} reachThreshold={3} ref={scrollRef}>
                    {Array.from({ length: 20 }, (_, i) => (
                        <Item key={i} label={`Line ${i}`} />
                    ))}
                </ScrollView>
            </Box>,
        );

        await delay(50);

        scrollRef.current?.scrollTo(13);
        await delay(50);

        scrollRef.current?.scrollTo(14);
        await delay(50);

        // Should only fire once
        expect(onReachEnd).toHaveBeenCalledTimes(1);
    });
});

describe("scrollView - followOutput", () => {
    it("should auto-scroll to bottom when content grows and user is at bottom", async () => {
        expect.assertions(1);

        const scrollRef = React.createRef<ScrollViewRef>();
        let setItemCount: (n: number) => void;

        const GrowingList = () => {
            const [count, setCount] = useState(5);

            setItemCount = setCount;

            return (
                <Box height={5}>
                    <ScrollView followOutput height={5} ref={scrollRef}>
                        {Array.from({ length: count }, (_, i) => (
                            <Item key={i} label={`Line ${i}`} />
                        ))}
                    </ScrollView>
                </Box>
            );
        };

        render(<GrowingList />);
        await delay(50);

        // Start at bottom
        scrollRef.current?.scrollToBottom();
        await delay(50);

        const offsetBefore = scrollRef.current?.getScrollOffset() ?? 0;

        // Add more items
        setItemCount!(10);
        await delay(100);

        const offsetAfter = scrollRef.current?.getScrollOffset() ?? 0;

        // Should have auto-scrolled to the new bottom
        expect(offsetAfter).toBeGreaterThan(offsetBefore);
    });
});

describe("scrollView - keyboard/vimBindings props exist", () => {
    it("should accept keyboard and vimBindings props without error", () => {
        expect.assertions(1);

        expect(() => {
            render(
                <Box height={5}>
                    <ScrollView height={5} keyboard vimBindings>
                        <Item label="Line 1" />
                        <Item label="Line 2" />
                    </ScrollView>
                </Box>,
            );
        }).not.toThrow();
    });
});

describe("scrollView - virtualize prop", () => {
    it("should accept virtualize and overscan props without error", async () => {
        expect.assertions(1);

        const scrollRef = React.createRef<ScrollViewRef>();

        render(
            <Box height={5}>
                <ScrollView height={5} overscan={2} ref={scrollRef} virtualize>
                    {Array.from({ length: 50 }, (_, i) => (
                        <Item key={i} label={`Line ${i}`} />
                    ))}
                </ScrollView>
            </Box>,
        );

        await delay(50);

        // Should still be able to scroll
        scrollRef.current?.scrollTo(10);
        await delay(50);

        expect(scrollRef.current?.getScrollOffset()).toBe(10);
    });
});
