/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, jsdoc/escape-inline-tags, unicorn/no-null */
// @ts-nocheck — reconciler createContainer arity varies between React versions
import React from "react";

import { Cell } from "../core/index";
import { FocusProvider } from "./focus";
import { TuiContext } from "./hooks";
import { LayoutNode } from "./layout";
import { TuiReconciler } from "./reconciler";
import { renderTreeToBuffer } from "./renderer";

export interface RenderToStringOptions {
    /** Width of the virtual terminal in columns. @default 80 */
    columns?: number;
    /** Height of the virtual terminal in rows. @default 24 */
    rows?: number;
}

/**
 * Render a React element to a plain string synchronously.
 * No TTY, no stdin, no alternate screen — pure layout + buffer read-back.
 *
 * Useful for testing, documentation generation, and any scenario where
 * you need rendered output as a string without a live terminal.
 *
 * Notes:
 * - Terminal hooks (useInput, useApp, useStdin, useStdout, useStderr,
 *   useFocus, useFocusManager) return safe no-op defaults — they do not throw.
 * - useEffect callbacks run but state updates they trigger do not affect output.
 * - useLayoutEffect callbacks fire synchronously and DO affect output.
 */
export function renderToString(element: React.ReactElement, options?: RenderToStringOptions): string {
    const cols = options?.columns ?? 80;
    const rows = options?.rows ?? 24;

    const rootNode = new LayoutNode();

    rootNode.yogaNode.setWidth(cols);
    rootNode.yogaNode.setHeight(rows);

    // No-op app/input stubs — hooks need a context but nothing should actually run
    const noopContext = {
        app: null as any,
        input: null as any,
        writeStderr: (_t: string) => {},
        writeStdout: (_t: string) => {},
    };

    const wrapped = React.createElement(TuiContext.Provider, { value: noopContext }, React.createElement(FocusProvider, null, element));

    // Create container in legacy (synchronous) mode
    const container = TuiReconciler.createContainer(
        rootNode,
        0, // LegacyRoot
        null,
        false,
        null,
        "renderToString",
        () => {},
        null,
    );

    // Render synchronously
    TuiReconciler.updateContainerSync(wrapped as any, container, null, () => {});
    TuiReconciler.flushSyncWork();

    // Layout and paint into a buffer
    rootNode.calculateLayout(cols, rows);
    const buffer = new Uint32Array(cols * rows * 2);

    renderTreeToBuffer(rootNode, buffer, cols, rows);

    // Read buffer back to string — trim trailing spaces from each row,
    // then strip empty trailing rows
    const lines: string[] = [];

    for (let row = 0; row < rows; row++) {
        let line = "";

        for (let col = 0; col < cols; col++) {
            const ch = buffer[(row * cols + col) * 2];
            const charString = Cell.getChar(ch);

            // Continuation cells (trailing half of wide glyphs) return "".
            // Emit a space so the string width matches the terminal cell count,
            // keeping snapshot text aligned in editors.
            line += charString === "" ? " " : charString;
        }

        lines.push(line.trimEnd());
    }

    // Remove trailing empty lines
    while (lines.length > 0 && lines.at(-1) === "") {
        lines.pop();
    }

    // Teardown: unmount the tree so reconciler cleans up
    TuiReconciler.updateContainerSync(null as any, container, null, () => {});
    TuiReconciler.flushSyncWork();
    rootNode.destroy();

    return lines.join("\n");
}
