import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LayoutNode } from "../../src/react/layout";
import { registerAfterCommit, TuiReconciler, unregisterAfterCommit } from "../../src/react/reconciler";

/**
 * The after-commit callback used to live in a single module-level slot, so a
 * second container silently stole the first container's commit notifications.
 * These tests lock in the per-container registry (finding tui-4).
 */
const createContainer = (node: LayoutNode) =>
    TuiReconciler.createContainer(node, 0, null, false, null, "", () => {}, null);

// The reconciler flushes commits on a microtask/timer, so let the scheduler run.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("react/reconciler after-commit registry", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("notifies only the container that committed", async () => {
        expect.assertions(4);

        const nodeA = new LayoutNode();
        const nodeB = new LayoutNode();
        const containerA = createContainer(nodeA);
        const containerB = createContainer(nodeB);

        const callbackA = vi.fn();
        const callbackB = vi.fn();

        registerAfterCommit(nodeA, callbackA);
        registerAfterCommit(nodeB, callbackB);

        TuiReconciler.updateContainer(React.createElement("box", null), containerA, null, () => {});
        await flush();

        expect(callbackA).toHaveBeenCalledTimes(1);
        expect(callbackB).not.toHaveBeenCalled();

        callbackA.mockClear();

        TuiReconciler.updateContainer(React.createElement("box", null), containerB, null, () => {});
        await flush();

        expect(callbackB).toHaveBeenCalledTimes(1);
        expect(callbackA).not.toHaveBeenCalled();

        unregisterAfterCommit(nodeA);
        unregisterAfterCommit(nodeB);
    });

    it("stops notifying a container after it is unregistered", async () => {
        expect.assertions(1);

        const node = new LayoutNode();
        const container = createContainer(node);
        const callback = vi.fn();

        registerAfterCommit(node, callback);
        unregisterAfterCommit(node);

        TuiReconciler.updateContainer(React.createElement("box", null), container, null, () => {});
        await flush();

        expect(callback).not.toHaveBeenCalled();
    });
});
