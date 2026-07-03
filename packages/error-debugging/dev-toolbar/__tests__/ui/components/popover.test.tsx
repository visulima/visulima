// @vitest-environment jsdom
/** @jsxImportSource preact */
import "../../setup";

import { act, cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "../../../src/ui/components/popover";

vi.mock(import("@floating-ui/dom"), () => {
    return {
        computePosition: vi.fn().mockResolvedValue({ x: 10, y: 20 }),
        flip: vi.fn(() => {
            return { name: "flip" };
        }),
        offset: vi.fn((n: number) => {
            return { name: "offset", options: n };
        }),
        shift: vi.fn(() => {
            return { name: "shift" };
        }),
    };
});

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(cleanup);

const BasicPopover = ({ defaultOpen, onOpenChange, open }: { defaultOpen?: boolean; onOpenChange?: (v: boolean) => void; open?: boolean }): JSX.Element => (
    <Popover defaultOpen={defaultOpen} onOpenChange={onOpenChange} open={open}>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>Popover body</PopoverContent>
    </Popover>
);

describe("popover", () => {
    it("popoverTrigger renders", () => {
        expect.hasAssertions();

        render(<BasicPopover />);

        expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
    });

    it("click on trigger opens content", async () => {
        expect.hasAssertions();

        render(<BasicPopover />);

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Open" }));
        });

        expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("popoverContent has role=dialog", async () => {
        expect.hasAssertions();

        render(<BasicPopover />);
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Open" }));
        });

        expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("click outside closes popover", async () => {
        expect.hasAssertions();

        render(<BasicPopover />);
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Open" }));
        });

        expect(screen.getByRole("dialog")).toBeInTheDocument();

        await act(async () => {
            fireEvent.mouseDown(document.body);
        });

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("popoverClose button closes the popover", async () => {
        expect.hasAssertions();

        render(
            <Popover>
                <PopoverTrigger>Open</PopoverTrigger>
                <PopoverContent>
                    content
                    <PopoverClose>Close</PopoverClose>
                </PopoverContent>
            </Popover>,
        );
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Open" }));
        });

        expect(screen.getByRole("dialog")).toBeInTheDocument();

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Close" }));
        });

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("controlled open=true shows content", () => {
        expect.hasAssertions();

        render(<BasicPopover open={true} />);

        expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("controlled: calls onOpenChange on trigger click", async () => {
        expect.hasAssertions();

        const onOpenChange = vi.fn();

        render(<BasicPopover onOpenChange={onOpenChange} open={false} />);
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Open" }));
        });

        expect(onOpenChange).toHaveBeenCalledWith(true);
    });

    it("merges custom class on PopoverContent", async () => {
        expect.hasAssertions();

        render(
            <Popover>
                <PopoverTrigger>Open</PopoverTrigger>
                <PopoverContent class="custom-popover">body</PopoverContent>
            </Popover>,
        );
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Open" }));
        });

        expect(screen.getByRole("dialog")).toHaveClass("custom-popover");
    });

    it("defaultOpen=true shows content immediately", () => {
        expect.hasAssertions();

        render(<BasicPopover defaultOpen={true} />);

        expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("disabled trigger does not open popover", async () => {
        expect.hasAssertions();

        render(
            <Popover>
                <PopoverTrigger disabled>Open</PopoverTrigger>
                <PopoverContent>body</PopoverContent>
            </Popover>,
        );

        expect(screen.getByRole("button", { name: "Open" })).toBeDisabled();

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Open" }));
        });

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("align prop is passed through to computePosition", async () => {
        expect.hasAssertions();

        const { computePosition } = await import("@floating-ui/dom");

        render(
            <Popover>
                <PopoverTrigger>Open</PopoverTrigger>
                <PopoverContent align="start" side="top">
                    body
                </PopoverContent>
            </Popover>,
        );
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Open" }));
        });
        await act(async () => {
            await Promise.resolve();
        });

        expect(computePosition).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ placement: "top-start" }));
    });
});
