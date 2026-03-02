// @vitest-environment jsdom
/** @jsxImportSource preact */
import "../../setup";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Tooltip, TooltipContent, TooltipTrigger } from "../../../src/ui/components/tooltip";

vi.mock("@floating-ui/dom", () => ({
    computePosition: vi.fn().mockResolvedValue({ x: 10, y: 20 }),
    flip: vi.fn(() => ({ name: "flip" })),
    offset: vi.fn((n: number) => ({ name: "offset", options: n })),
    shift: vi.fn(() => ({ name: "shift" })),
}));

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(cleanup);

describe("Tooltip", () => {
    it("TooltipTrigger renders children", () => {
        render(
            <Tooltip>
                <TooltipTrigger>Hover me</TooltipTrigger>
                <TooltipContent>Tip</TooltipContent>
            </Tooltip>,
        );
        expect(screen.getByText("Hover me")).toBeInTheDocument();
    });

    it("hover on trigger shows content", async () => {
        render(
            <Tooltip>
                <TooltipTrigger>Hover me</TooltipTrigger>
                <TooltipContent>Tip text</TooltipContent>
            </Tooltip>,
        );
        expect(screen.queryByText("Tip text")).not.toBeInTheDocument();
        await act(async () => {
            fireEvent.mouseEnter(screen.getByText("Hover me"));
        });
        expect(screen.getByText("Tip text")).toBeInTheDocument();
    });

    it("mouse leave hides content", async () => {
        render(
            <Tooltip>
                <TooltipTrigger>Hover me</TooltipTrigger>
                <TooltipContent>Tip text</TooltipContent>
            </Tooltip>,
        );
        await act(async () => {
            fireEvent.mouseEnter(screen.getByText("Hover me"));
        });
        expect(screen.getByText("Tip text")).toBeInTheDocument();
        await act(async () => {
            fireEvent.mouseLeave(screen.getByText("Hover me"));
        });
        expect(screen.queryByText("Tip text")).not.toBeInTheDocument();
    });

    it("TooltipContent has role=tooltip", async () => {
        render(
            <Tooltip>
                <TooltipTrigger>Hover me</TooltipTrigger>
                <TooltipContent>Tip</TooltipContent>
            </Tooltip>,
        );
        await act(async () => {
            fireEvent.mouseEnter(screen.getByText("Hover me"));
        });
        expect(screen.getByRole("tooltip")).toBeInTheDocument();
    });

    it("TooltipContent renders children", async () => {
        render(
            <Tooltip>
                <TooltipTrigger>Trigger</TooltipTrigger>
                <TooltipContent>My tooltip content</TooltipContent>
            </Tooltip>,
        );
        await act(async () => {
            fireEvent.mouseEnter(screen.getByText("Trigger"));
        });
        expect(screen.getByText("My tooltip content")).toBeInTheDocument();
    });

    it("merges custom class on TooltipContent", async () => {
        render(
            <Tooltip>
                <TooltipTrigger>Trigger</TooltipTrigger>
                <TooltipContent class="my-tooltip">content</TooltipContent>
            </Tooltip>,
        );
        await act(async () => {
            fireEvent.mouseEnter(screen.getByText("Trigger"));
        });
        expect(screen.getByRole("tooltip")).toHaveClass("my-tooltip");
    });

    it("passes side prop to computePosition", async () => {
        const { computePosition } = await import("@floating-ui/dom");
        render(
            <Tooltip>
                <TooltipTrigger>Trigger</TooltipTrigger>
                <TooltipContent side="right">content</TooltipContent>
            </Tooltip>,
        );
        await act(async () => {
            fireEvent.mouseEnter(screen.getByText("Trigger"));
        });
        await act(async () => {
            await Promise.resolve();
        });
        expect(computePosition).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            expect.objectContaining({ placement: "right" }),
        );
    });

    it("sideOffset defaults to 4", async () => {
        const { offset } = await import("@floating-ui/dom");
        render(
            <Tooltip>
                <TooltipTrigger>Trigger</TooltipTrigger>
                <TooltipContent>content</TooltipContent>
            </Tooltip>,
        );
        await act(async () => {
            fireEvent.mouseEnter(screen.getByText("Trigger"));
        });
        await act(async () => {
            await Promise.resolve();
        });
        expect(offset).toHaveBeenCalledWith(4);
    });

    it("delayDuration=0 shows immediately (default)", async () => {
        render(
            <Tooltip delayDuration={0}>
                <TooltipTrigger>Trigger</TooltipTrigger>
                <TooltipContent>content</TooltipContent>
            </Tooltip>,
        );
        await act(async () => {
            fireEvent.mouseEnter(screen.getByText("Trigger"));
        });
        expect(screen.getByText("content")).toBeInTheDocument();
    });
});
