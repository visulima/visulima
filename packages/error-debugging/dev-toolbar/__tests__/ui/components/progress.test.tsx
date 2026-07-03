// @vitest-environment jsdom
/** @jsxImportSource preact */
import "../../setup";

import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import Progress from "../../../src/ui/components/progress";

afterEach(cleanup);

describe("progress", () => {
    it("has role=progressbar", () => {
        expect.hasAssertions();

        render(<Progress />);

        expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });

    it("sets aria-valuenow from value prop", () => {
        expect.hasAssertions();

        render(<Progress value={42} />);

        expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "42");
    });

    it("sets aria-valuemin=0", () => {
        expect.hasAssertions();

        render(<Progress value={50} />);

        expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemin", "0");
    });

    it("sets aria-valuemax=100", () => {
        expect.hasAssertions();

        render(<Progress value={50} />);

        expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "100");
    });

    it("value=0 → translateX(-100%)", () => {
        expect.hasAssertions();

        render(<Progress value={0} />);
        const indicator = screen.getByRole("progressbar").firstElementChild as HTMLElement;

        expect(indicator.style.transform).toBe("translateX(-100%)");
    });

    it("value=50 → translateX(-50%)", () => {
        expect.hasAssertions();

        render(<Progress value={50} />);
        const indicator = screen.getByRole("progressbar").firstElementChild as HTMLElement;

        expect(indicator.style.transform).toBe("translateX(-50%)");
    });

    it("value=100 → translateX(0%)", () => {
        expect.hasAssertions();

        render(<Progress value={100} />);
        const indicator = screen.getByRole("progressbar").firstElementChild as HTMLElement;

        expect(indicator.style.transform).toBe("translateX(-0%)");
    });

    it("defaults aria-valuenow to 0 when no value", () => {
        expect.hasAssertions();

        render(<Progress />);

        expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    });

    it("merges custom class on container", () => {
        expect.hasAssertions();

        render(<Progress class="my-progress" value={50} />);

        expect(screen.getByRole("progressbar")).toHaveClass("my-progress");
    });

    it("indicator has bg-primary class", () => {
        expect.hasAssertions();

        render(<Progress value={50} />);
        const indicator = screen.getByRole("progressbar").firstElementChild;

        expect(indicator).toHaveClass("bg-primary");
    });
});
