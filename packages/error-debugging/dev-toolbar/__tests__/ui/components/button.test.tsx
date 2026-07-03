// @vitest-environment jsdom
/** @jsxImportSource preact */
import "../../setup";

import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import Button from "../../../src/ui/components/button";

afterEach(cleanup);

describe("button", () => {
    it("renders children", () => {
        expect.hasAssertions();

        render(<Button>Click me</Button>);

        expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
    });

    it("applies default variant classes", () => {
        expect.hasAssertions();

        render(<Button>btn</Button>);
        const button = screen.getByRole("button");

        expect(button.className).toContain("bg-primary");
        expect(button.className).toContain("text-primary-foreground");
    });

    it("applies destructive variant classes", () => {
        expect.hasAssertions();

        render(<Button variant="destructive">btn</Button>);

        expect(screen.getByRole("button").className).toContain("bg-destructive");
    });

    it("applies outline variant classes", () => {
        expect.hasAssertions();

        render(<Button variant="outline">btn</Button>);

        expect(screen.getByRole("button").className).toContain("border-input");
    });

    it("applies secondary variant classes", () => {
        expect.hasAssertions();

        render(<Button variant="secondary">btn</Button>);

        expect(screen.getByRole("button").className).toContain("bg-secondary");
    });

    it("applies ghost variant classes", () => {
        expect.hasAssertions();

        render(<Button variant="ghost">btn</Button>);

        expect(screen.getByRole("button").className).toContain("hover:bg-foreground/8");
    });

    it("applies link variant classes", () => {
        expect.hasAssertions();

        render(<Button variant="link">btn</Button>);

        expect(screen.getByRole("button").className).toContain("text-primary");
        expect(screen.getByRole("button").className).toContain("underline-offset-4");
    });

    it("applies default size classes", () => {
        expect.hasAssertions();

        render(<Button>btn</Button>);

        expect(screen.getByRole("button").className).toContain("h-9");
    });

    it("applies sm size classes", () => {
        expect.hasAssertions();

        render(<Button size="sm">btn</Button>);

        expect(screen.getByRole("button").className).toContain("h-8");
    });

    it("applies lg size classes", () => {
        expect.hasAssertions();

        render(<Button size="lg">btn</Button>);

        expect(screen.getByRole("button").className).toContain("h-10");
    });

    it("applies icon size classes", () => {
        expect.hasAssertions();

        render(<Button size="icon">btn</Button>);

        expect(screen.getByRole("button").className).toContain("w-9");
    });

    it("merges custom class", () => {
        expect.hasAssertions();

        render(<Button class="custom-class">btn</Button>);

        expect(screen.getByRole("button").className).toContain("custom-class");
    });

    it("calls onClick handler", () => {
        expect.hasAssertions();

        const onClick = vi.fn();

        render(<Button onClick={onClick}>btn</Button>);
        fireEvent.click(screen.getByRole("button"));

        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("has disabled attribute when disabled", () => {
        expect.hasAssertions();

        render(<Button disabled>btn</Button>);

        expect(screen.getByRole("button")).toBeDisabled();
    });

    it("has type=button by default", () => {
        expect.hasAssertions();

        render(<Button>btn</Button>);

        expect(screen.getByRole("button")).toHaveAttribute("type", "button");
    });

    it("passes through additional attributes", () => {
        expect.hasAssertions();

        render(<Button data-testid="my-btn">btn</Button>);

        expect(screen.getByTestId("my-btn")).toBeInTheDocument();
    });
});
