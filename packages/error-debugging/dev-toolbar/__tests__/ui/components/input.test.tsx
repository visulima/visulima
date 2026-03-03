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
        render(<Input />);

        expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("defaults to type=text", () => {
        render(<Input />);

        expect(screen.getByRole("textbox")).toHaveAttribute("type", "text");
    });

    it("overrides type", () => {
        render(<Input type="email" />);

        expect(document.querySelector("input")).toHaveAttribute("type", "email");
    });

    it("has border class", () => {
        render(<Input />);

        expect(screen.getByRole("textbox")).toHaveClass("border-input");
    });

    it("has focus-visible ring class", () => {
        render(<Input />);

        expect(screen.getByRole("textbox").className).toContain("focus-visible:ring-ring");
    });

    it("has placeholder class", () => {
        render(<Input />);

        expect(screen.getByRole("textbox").className).toContain("placeholder:text-muted-foreground");
    });

    it("fires onChange", () => {
        const onChange = vi.fn();

        render(<Input onChange={onChange} />);
        fireEvent.change(screen.getByRole("textbox"), { target: { value: "hello" } });

        expect(onChange).toHaveBeenCalled();
    });

    it("can be disabled", () => {
        render(<Input disabled />);

        expect(screen.getByRole("textbox")).toBeDisabled();
    });

    it("forwards ref", () => {
        const ref = createRef<HTMLInputElement>();

        render(<Input ref={ref} />);

        expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });

    it("merges custom class", () => {
        render(<Input class="my-input" />);

        expect(screen.getByRole("textbox")).toHaveClass("my-input");
    });

    it("passes through additional attributes", () => {
        render(<Input placeholder="Enter value" />);

        expect(screen.getByPlaceholderText("Enter value")).toBeInTheDocument();
    });
});
