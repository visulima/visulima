// @vitest-environment jsdom
/** @jsxImportSource preact */
import "../setup";

import type { Spec } from "@json-render/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import type { JSX } from "preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { JsonViewRegistry } from "../../src/json-view";
import { JsonView } from "../../src/json-view";

afterEach(cleanup);

const Box = ({ children, label }: { children?: JSX.Element[]; label?: string }): JSX.Element => (
    <div data-testid="box">
        {label}
        {children}
    </div>
);

const Pressable = ({ label, onClick }: { label: string; onClick?: (event: Event) => void }): JSX.Element => (
    <button onClick={onClick} type="button">
        {label}
    </button>
);

const registry: JsonViewRegistry = { Box, Pressable };

describe("jsonView", () => {
    it("renders the root element and its children in order", () => {
        expect.hasAssertions();

        const spec: Spec = {
            elements: {
                child1: { props: { label: "first" }, type: "Box" },
                child2: { props: { label: "second" }, type: "Box" },
                root: { children: ["child1", "child2"], props: {}, type: "Box" },
            },
            root: "root",
        };

        render(<JsonView registry={registry} spec={spec} />);

        expect(screen.getAllByTestId("box").map((node) => node.textContent)).toStrictEqual(["firstsecond", "first", "second"]);
    });

    it("skips a child reference that has no element", () => {
        expect.hasAssertions();

        const spec: Spec = {
            elements: {
                kept: { props: { label: "kept" }, type: "Box" },
                root: { children: ["missing", "kept"], props: {}, type: "Box" },
            },
            root: "root",
        };

        render(<JsonView registry={registry} spec={spec} />);

        expect(screen.getByText("kept")).toBeInTheDocument();
    });

    it("skips an element whose type is not in the registry", () => {
        expect.hasAssertions();

        const spec: Spec = {
            elements: {
                root: { children: ["unknown"], props: {}, type: "Box" },
                unknown: { props: { label: "ghost" }, type: "NotRegistered" },
            },
            root: "root",
        };

        render(<JsonView registry={registry} spec={spec} />);

        expect(screen.queryByText("ghost")).not.toBeInTheDocument();
    });

    it("hides an element whose visible condition is false for the seeded state", () => {
        expect.hasAssertions();

        const spec: Spec = {
            elements: {
                hidden: { props: { label: "secret" }, type: "Box", visible: { $state: "/revealed" } },
                root: { children: ["hidden"], props: {}, type: "Box" },
            },
            root: "root",
            state: { revealed: false },
        };

        render(<JsonView registry={registry} spec={spec} />);

        expect(screen.queryByText("secret")).not.toBeInTheDocument();
    });

    it("resolves a prop bound to state", () => {
        expect.hasAssertions();

        const spec: Spec = {
            elements: { root: { props: { label: { $state: "/title" } }, type: "Box" } },
            root: "root",
            state: { title: "from state" },
        };

        render(<JsonView registry={registry} spec={spec} />);

        expect(screen.getByText("from state")).toBeInTheDocument();
    });

    it("dispatches a named action with its params when the bound event fires", () => {
        expect.hasAssertions();

        const refresh = vi.fn();

        const spec: Spec = {
            elements: { root: { on: { click: { action: "refresh", params: { source: "header" } } }, props: { label: "Refresh" }, type: "Pressable" } },
            root: "root",
        };

        render(<JsonView actions={{ refresh }} registry={registry} spec={spec} />);
        fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

        expect(refresh).toHaveBeenCalledWith({ source: "header" }, expect.anything());
    });

    it("re-renders when an action writes to the store", () => {
        expect.hasAssertions();

        const spec: Spec = {
            elements: {
                pane: { props: { label: "now visible" }, type: "Box", visible: { $state: "/revealed" } },
                root: { children: ["toggle", "pane"], props: {}, type: "Box" },
                toggle: { on: { click: { action: "reveal" } }, props: { label: "Reveal" }, type: "Pressable" },
            },
            root: "root",
            state: { revealed: false },
        };

        render(
            <JsonView
                actions={{
                    reveal: (_parameters, store) => {
                        store.set("/revealed", true);
                    },
                }}
                registry={registry}
                spec={spec}
            />,
        );

        expect(screen.queryByText("now visible")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Reveal" }));

        expect(screen.getByText("now visible")).toBeInTheDocument();
    });
});
