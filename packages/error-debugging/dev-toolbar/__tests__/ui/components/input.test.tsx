// @vitest-environment jsdom
/** @jsxImportSource preact */
import "../../setup";

import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { createRef } from "preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import Input from "../../../src/ui/components/input";

afterEach(cleanup);

describe("input", () => {
    it("renders an input element", () => {
        expect.hasAssertions();

        render(<Input />);

        expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("defaults to type=text", () => {
        expect.hasAssertions();

        render(<Input />);

        expect(screen.getByRole("textbox")).toHaveAttribute("type", "text");
    });

    it("overrides type", () => {
        expect.hasAssertions();

        render(<Input type="email" />);

        expect(document.querySelector("input")).toHaveAttribute("type", "email");
    });

    it("has border class", () => {
        expect.hasAssertions();

        render(<Input />);

        expect(screen.getByRole("textbox")).toHaveClass("border-input");
    });

    it("has focus-visible ring class", () => {
        expect.hasAssertions();

        render(<Input />);

        expect(screen.getByRole("textbox").className).toContain("focus-visible:ring-ring");
    });

    it("has placeholder class", () => {
        expect.hasAssertions();

        render(<Input />);

        expect(screen.getByRole("textbox").className).toContain("placeholder:text-muted-foreground");
    });

    it("fires onChange", () => {
        expect.hasAssertions();

        const onChange = vi.fn();

        render(<Input onChange={onChange} />);
        fireEvent.change(screen.getByRole("textbox"), { target: { value: "hello" } });

        expect(onChange).toHaveBeenCalledWith(expect.anything());
    });

    it("can be disabled", () => {
        expect.hasAssertions();

        render(<Input disabled />);

        expect(screen.getByRole("textbox")).toBeDisabled();
    });

    it("forwards ref", () => {
        expect.hasAssertions();

        const ref = createRef<HTMLInputElement>();

        render(<Input ref={ref} />);

        expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });

    it("merges custom class", () => {
        expect.hasAssertions();

        render(<Input class="my-input" />);

        expect(screen.getByRole("textbox")).toHaveClass("my-input");
    });

    it("passes through additional attributes", () => {
        expect.hasAssertions();

        render(<Input placeholder="Enter value" />);

        expect(screen.getByPlaceholderText("Enter value")).toBeInTheDocument();
    });
});
