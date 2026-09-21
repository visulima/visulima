// @vitest-environment jsdom
/** @jsxImportSource preact */
import "../../setup";

import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import EnvTable from "../../../src/apps/vite-config/components/env-table";
import PluginList from "../../../src/apps/vite-config/components/plugin-list";
import buildViteConfigSpec from "../../../src/apps/vite-config/spec";
import type { ViteConfig } from "../../../src/apps/vite-config/types";
import type { JsonViewRegistry } from "../../../src/json-view";
import { baseActions, baseRegistry, JsonView } from "../../../src/json-view";

afterEach(cleanup);

const registry: JsonViewRegistry = { ...baseRegistry, EnvTable, PluginList };

const config: ViteConfig = {
    base: "/",
    env: { SECRET_TOKEN: "s3cret" },
    mode: "development",
    plugins: [{ name: "vite:core" }, { enforce: "pre", name: "my-plugin" }],
    resolve: { alias: { "@": "/home/user/project/src" } },
    root: "/home/user/project",
    server: { port: 5173, strictPort: true },
};

const renderPanel = (actions: Record<string, () => void> = {}) =>
    render(<JsonView actions={{ ...baseActions, ...actions }} registry={registry} spec={buildViteConfigSpec(config)} />);

describe("vite config panel", () => {
    it("renders the header badges and the stats strip", () => {
        expect.hasAssertions();

        renderPanel();

        expect(screen.getByText("development")).toBeInTheDocument();
        expect(screen.getByText("plugins")).toBeInTheDocument();
    });

    it("renders the server key-value rows from the spec", () => {
        expect.hasAssertions();

        renderPanel();

        expect(screen.getByText("port")).toBeInTheDocument();
        expect(screen.getByText("5173")).toBeInTheDocument();
    });

    it("keeps the hand-written plugin filter working inside the rendered spec", () => {
        expect.hasAssertions();

        renderPanel();
        fireEvent.click(screen.getByRole("tab", { name: "Plugins (2)" }));

        expect(screen.getByText("my-plugin")).toBeInTheDocument();

        fireEvent.input(screen.getByPlaceholderText("filter 2 plugins…"), { target: { value: "core" } });

        expect(screen.queryByText("my-plugin")).not.toBeInTheDocument();
        expect(screen.getByText("vite:core")).toBeInTheDocument();
    });

    it("keeps env values masked until revealed", () => {
        expect.hasAssertions();

        renderPanel();
        fireEvent.click(screen.getByRole("tab", { name: "Env & Define (1)" }));

        expect(screen.queryByText("s3cret")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "reveal all" }));

        expect(screen.getByText("s3cret")).toBeInTheDocument();
    });

    it("runs the refresh action when the header button is clicked", () => {
        expect.hasAssertions();

        const refresh = vi.fn();

        renderPanel({ refresh });
        fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

        expect(refresh).toHaveBeenCalledTimes(1);
    });
});
