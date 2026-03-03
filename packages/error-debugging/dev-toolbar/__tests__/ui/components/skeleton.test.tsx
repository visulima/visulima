// @vitest-environment jsdom
/** @jsxImportSource preact */
import "../../setup";

import { cleanup, render } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import Skeleton from "../../../src/ui/components/skeleton";

afterEach(cleanup);

describe("skeleton", () => {
    it("has animate-pulse class", () => {
        const { container } = render(<Skeleton />);

        expect(container.firstChild).toHaveClass("animate-pulse");
    });

    it("has bg-primary/10 class", () => {
        const { container } = render(<Skeleton />);

        expect(container.firstChild).toHaveClass("bg-primary/10");
    });

    it("merges custom class", () => {
        const { container } = render(<Skeleton class="h-4 w-20" />);

        expect(container.firstChild).toHaveClass("h-4", "w-20", "animate-pulse");
    });

    it("renders without children", () => {
        const { container } = render(<Skeleton />);

        expect(container.firstChild).toBeInTheDocument();
    });
});
