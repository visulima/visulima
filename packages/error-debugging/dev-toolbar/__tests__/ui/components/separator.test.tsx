// @vitest-environment jsdom
/** @jsxImportSource preact */
import "../../setup";

import { cleanup, render } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";

import Separator from "../../../src/ui/components/separator";

afterEach(cleanup);

describe("separator", () => {
    it("renders with horizontal classes by default", () => {
        expect.hasAssertions();

        const { container } = render(<Separator />);

        expect(container.firstChild).toHaveClass("h-[1px]", "w-full");
    });

    it("renders with vertical classes when orientation=vertical", () => {
        expect.hasAssertions();

        const { container } = render(<Separator orientation="vertical" />);

        expect(container.firstChild).toHaveClass("h-full", "w-[1px]");
    });

    it("defaults to horizontal orientation", () => {
        expect.hasAssertions();

        const { container } = render(<Separator />);

        expect(container.firstChild).toHaveClass("h-[1px]");
    });

    it("decorative=true sets role=none", () => {
        expect.hasAssertions();

        const { container } = render(<Separator decorative />);

        expect(container.firstChild).toHaveAttribute("role", "none");
    });

    it("decorative=false sets role=separator", () => {
        expect.hasAssertions();

        const { container } = render(<Separator decorative={false} />);

        expect(container.firstChild).toHaveAttribute("role", "separator");
    });

    it("decorative=false sets aria-orientation", () => {
        expect.hasAssertions();

        const { container } = render(<Separator decorative={false} orientation="vertical" />);

        expect(container.firstChild).toHaveAttribute("aria-orientation", "vertical");
    });

    it("merges custom class", () => {
        expect.hasAssertions();

        const { container } = render(<Separator class="my-sep" />);

        expect(container.firstChild).toHaveClass("my-sep");
    });
});
