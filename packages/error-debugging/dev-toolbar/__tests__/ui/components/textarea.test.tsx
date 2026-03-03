// @vitest-environment jsdom
/** @jsxImportSource preact */
import "../../setup";

import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { createRef } from "preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import Textarea from "../../../src/ui/components/textarea";

afterEach(cleanup);

describe("textarea", () => {
    it("renders a textarea element", () => {
        expect.hasAssertions();

        render(<Textarea />);

        expect(screen.getByRole("textbox")).toBeInTheDocument();
        expect(screen.getByRole("textbox").tagName).toBe("TEXTAREA");
    });

    it("has min-h-[60px] class", () => {
        expect.hasAssertions();

        render(<Textarea />);

        expect(screen.getByRole("textbox").className).toContain("min-h-[60px]");
    });

    it("has placeholder class", () => {
        expect.hasAssertions();

        render(<Textarea />);

        expect(screen.getByRole("textbox").className).toContain("placeholder:text-muted-foreground");
    });

    it("fires onChange", () => {
        expect.hasAssertions();

        const onChange = vi.fn();

        render(<Textarea onChange={onChange} />);
        fireEvent.change(screen.getByRole("textbox"), { target: { value: "hello" } });

        expect(onChange).toHaveBeenCalledWith(expect.anything());
    });

    it("can be disabled", () => {
        expect.hasAssertions();

        render(<Textarea disabled />);

        expect(screen.getByRole("textbox")).toBeDisabled();
    });

    it("forwards ref", () => {
        expect.hasAssertions();

        const ref = createRef<HTMLTextAreaElement>();

        render(<Textarea ref={ref} />);

        expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
    });

    it("merges custom class", () => {
        expect.hasAssertions();

        render(<Textarea class="custom-ta" />);

        expect(screen.getByRole("textbox")).toHaveClass("custom-ta");
    });

    it("passes through additional attributes", () => {
        expect.hasAssertions();

        render(<Textarea placeholder="Write here" />);

        expect(screen.getByPlaceholderText("Write here")).toBeInTheDocument();
    });
});
