// @vitest-environment jsdom
/** @jsxImportSource preact */
import "../../setup";

import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import Switch from "../../../src/ui/components/switch";

afterEach(cleanup);

describe("switch", () => {
    it("has role=switch", () => {
        expect.hasAssertions();

        render(<Switch />);

        expect(screen.getByRole("switch")).toBeInTheDocument();
    });

    it("aria-checked is false by default", () => {
        expect.hasAssertions();

        render(<Switch />);

        expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    });

    it("aria-checked is true when defaultChecked=true", () => {
        expect.hasAssertions();

        render(<Switch defaultChecked />);

        expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    });

    it("toggles when clicked (uncontrolled)", () => {
        expect.hasAssertions();

        render(<Switch />);
        const sw = screen.getByRole("switch");

        expect(sw).toHaveAttribute("aria-checked", "false");

        fireEvent.click(sw);

        expect(sw).toHaveAttribute("aria-checked", "true");

        fireEvent.click(sw);

        expect(sw).toHaveAttribute("aria-checked", "false");
    });

    it("calls onCheckedChange when toggled", () => {
        expect.hasAssertions();

        const onCheckedChange = vi.fn();

        render(<Switch onCheckedChange={onCheckedChange} />);
        fireEvent.click(screen.getByRole("switch"));

        expect(onCheckedChange).toHaveBeenCalledWith(true);
    });

    it("controlled: respects checked prop", () => {
        expect.hasAssertions();

        render(<Switch checked={true} onCheckedChange={() => {}} />);

        expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    });

    it("controlled: calls onCheckedChange on click", () => {
        expect.hasAssertions();

        const onCheckedChange = vi.fn();

        render(<Switch checked={false} onCheckedChange={onCheckedChange} />);
        fireEvent.click(screen.getByRole("switch"));

        expect(onCheckedChange).toHaveBeenCalledWith(true);
    });

    it("does not toggle when disabled", () => {
        expect.hasAssertions();

        render(<Switch disabled />);
        const sw = screen.getByRole("switch");

        fireEvent.click(sw);

        expect(sw).toHaveAttribute("aria-checked", "false");
    });

    it("sets data-state attribute", () => {
        expect.hasAssertions();

        render(<Switch defaultChecked />);

        expect(screen.getByRole("switch")).toHaveAttribute("data-state", "checked");
    });

    it("merges custom class", () => {
        expect.hasAssertions();

        render(<Switch class="my-switch" />);

        expect(screen.getByRole("switch")).toHaveClass("my-switch");
    });

    it("sets id attribute", () => {
        expect.hasAssertions();

        render(<Switch id="my-switch" />);

        expect(screen.getByRole("switch")).toHaveAttribute("id", "my-switch");
    });
});
