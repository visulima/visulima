/* eslint-disable @typescript-eslint/no-explicit-any, unicorn/no-null, unicorn/prefer-dom-node-remove */
import Yoga from "yoga-layout";

import { measureTextBlock } from "./text-width";

type YogaNode = ReturnType<typeof Yoga.Node.create>;

// Global registry: yogaNode → owning LayoutNode
// Used to reliably detach nodes regardless of JS object identity issues
// with the Yoga wasm wrapper's getParent() returning stale proxy objects.
const yogaOwner = new Map<YogaNode, LayoutNode>();

export class LayoutNode {
    public yogaNode: YogaNode;

    public children: LayoutNode[] = [];

    public parent: LayoutNode | null = null;

    private _destroyed = false;

    _hidden = false; // set by Suspense hideInstance/unhideInstance

    transform?: (s: string, index: number) => string; // set by <Transform>

    // Custom terminal props
    private _text?: string;

    public fg: number = 255;

    public bg: number = 255;

    public styles: number = 0;

    public _style?: any;

    set text(value: string | undefined) {
        this._text = value;

        if (value === undefined) {
            this.yogaNode.unsetMeasureFunc();
        } else {
            this.yogaNode.setMeasureFunc((width, widthMode, height, heightMode) => {
                if (value.length === 0) {
                    return { height: 0, width: 0 };
                }

                const unconstrained = measureTextBlock(value, Number.MAX_SAFE_INTEGER);

                let targetWidth = unconstrained.maxLineWidth;

                if (widthMode === Yoga.MEASURE_MODE_EXACTLY) {
                    targetWidth = Math.max(0, Math.floor(width));
                } else if (widthMode === Yoga.MEASURE_MODE_AT_MOST) {
                    targetWidth = Math.min(unconstrained.maxLineWidth, Math.max(0, Math.floor(width)));
                }

                let targetHeight = unconstrained.wrappedRows;

                if (targetWidth > 0) {
                    targetHeight = measureTextBlock(value, targetWidth).wrappedRows;
                }

                if (heightMode === Yoga.MEASURE_MODE_EXACTLY) {
                    targetHeight = Math.max(0, Math.floor(height));
                } else if (heightMode === Yoga.MEASURE_MODE_AT_MOST) {
                    targetHeight = Math.min(targetHeight, Math.max(0, Math.floor(height)));
                }

                return { height: targetHeight, width: targetWidth };
            });
        }
    }

    get text(): string | undefined {
        return this._text;
    }

    constructor() {
        this.yogaNode = Yoga.Node.create();
        // Default to flex-direction column like Ink/React Native
        this.yogaNode.setFlexDirection(Yoga.FLEX_DIRECTION_COLUMN);
    }

    insertChild(child: LayoutNode, index: number): void {
        // Remove from current owner first (yogaOwner is authoritative)
        const currentOwner = yogaOwner.get(child.yogaNode);

        if (currentOwner) {
            currentOwner.removeChild(child);
        }

        // Belt-and-suspenders: ask Yoga directly in case yogaOwner is stale
        const staleParent = child.yogaNode.getParent();

        if (staleParent) {
            staleParent.removeChild(child.yogaNode);
        }

        // Clamp index to Yoga's actual child count to stay in sync
        const yogaCount = this.yogaNode.getChildCount();
        const safeIndex = Math.min(index, yogaCount);

        // Insert into Yoga FIRST — if this throws, don't corrupt our JS bookkeeping
        try {
            this.yogaNode.insertChild(child.yogaNode, safeIndex);
        } catch {
            // Yoga refused the insert — child stays detached
            return;
        }

        // Only update JS bookkeeping after Yoga succeeds
        child.parent = this;
        this.children.splice(safeIndex, 0, child);
        yogaOwner.set(child.yogaNode, this);
    }

    remove(): void {
        if (this.parent) {
            this.parent.removeChild(this);
        }
    }

    removeChild(child: LayoutNode): void {
        const i = this.children.indexOf(child);

        if (i !== -1) {
            this.children.splice(i, 1);
            child.parent = null;
            yogaOwner.delete(child.yogaNode);

            const yogaParent = child.yogaNode.getParent();

            if (yogaParent) {
                yogaParent.removeChild(child.yogaNode);
            }
        }
    }

    /**
     * Free this node's Yoga allocation. Called via detachDeletedInstance
     * in the reconciler after React has permanently removed this node.
     *
     * Does NOT recurse — React calls detachDeletedInstance on every node
     * in a deleted subtree individually, so each node frees only itself.
     * The _destroyed guard prevents double-free if free() is also called.
     */
    destroy(): void {
        if (this._destroyed) {
            return;
        }

        this._destroyed = true;

        // Clear parent reference on children before clearing our own bookkeeping
        for (const child of this.children) {
            if (child.parent === this) {
                child.parent = null;
            }
        }

        this.children = [];
        yogaOwner.delete(this.yogaNode);
        // Free the native Yoga allocation. Safe because React always calls
        // removeChild (which calls yogaNode.removeChild) before calling
        // detachDeletedInstance (which calls destroy()). Belt-and-suspenders:
        // if somehow the node is still attached, remove it first so free()
        // doesn't corrupt the parent's child list in the wasm heap.
        const staleParent = this.yogaNode.getParent();

        if (staleParent) {
            staleParent.removeChild(this.yogaNode);
        }

        this.yogaNode.free();
    }

    calculateLayout(width: number, height: number): void {
        this.yogaNode.setWidth(width);
        this.yogaNode.setHeight(height);
        this.yogaNode.calculateLayout(width, height, Yoga.DIRECTION_LTR);
    }

    getLayout(): ReturnType<YogaNode["getComputedLayout"]> {
        return this.yogaNode.getComputedLayout();
    }
}
