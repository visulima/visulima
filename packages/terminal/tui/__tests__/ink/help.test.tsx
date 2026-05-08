import { strip as stripAnsi } from "@visulima/ansi";
import React from "react";
import { describe, expect, it } from "vitest";

import { Help } from "../../src/components/index";
import type { KeyBinding } from "../../src/ink/hooks/use-key-bindings";
import { renderToString } from "../helpers/ink-render";

const bindings: KeyBinding[] = [
    { description: "Quit", key: "q" },
    { description: "Move up", key: ["upArrow", "k"] },
    { description: "Select", key: "return" },
];

describe("help", () => {
    it("renders short mode by default", () => {
        expect.assertions(1);

        const output = stripAnsi(renderToString(<Help bindings={bindings} />));

        expect(output).toContain("q Quit");
    });

    it("renders key labels with humanized names", () => {
        expect.assertions(3);

        const output = stripAnsi(renderToString(<Help bindings={bindings} />));

        // upArrow should be rendered as ↑, with flex spacing there may be extra spaces
        expect(output).toContain("\u2191/k");
        expect(output).toContain("Move up");
        // return should be rendered as enter
        expect(output).toContain("enter Select");
    });

    it("renders separator between items in short mode", () => {
        expect.assertions(1);

        const output = stripAnsi(renderToString(<Help bindings={bindings} separator=" | " />));

        expect(output).toContain(" | ");
    });

    it("renders full mode with groups", () => {
        expect.assertions(2);

        const groupedBindings: KeyBinding[] = [
            { description: "Move up", group: "Navigation", key: "upArrow" },
            { description: "Move down", group: "Navigation", key: "downArrow" },
            { description: "Quit", group: "General", key: "q" },
        ];

        const output = stripAnsi(renderToString(<Help bindings={groupedBindings} mode="full" />));

        expect(output).toContain("Navigation");
        expect(output).toContain("General");
    });

    it("renders empty bindings without errors", () => {
        expect.assertions(1);

        const output = renderToString(<Help bindings={[]} />);

        expect(output).toBe("");
    });

    it("handles modifier combo keys", () => {
        expect.assertions(1);

        const ctrlBindings: KeyBinding[] = [{ description: "Save", key: "ctrl+s" }];

        const output = stripAnsi(renderToString(<Help bindings={ctrlBindings} />));

        expect(output).toContain("ctrl+s Save");
    });
});
