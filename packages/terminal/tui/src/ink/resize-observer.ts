/* eslint-disable no-console */

/**
 * ResizeObserver API for terminal UI elements.
 *
 * Mirrors the browser ResizeObserver API, allowing components to react
 * to size changes of DOM elements after layout computation.
 *
 * Ported from jacob314/ink fork (Google LLC, Apache-2.0).
 */
import type { DOMElement } from "./dom";

export type ResizeObserverCallback = (entries: ResizeObserverEntry[], observer: ResizeObserver) => void;

export class ResizeObserverEntry {
    constructor(
        readonly target: DOMElement,
        readonly contentRect: Readonly<{ height: number; width: number }>,
    ) {}
}

class ResizeObserver {
    private readonly callback: ResizeObserverCallback;

    private readonly observedElements = new Set<DOMElement>();

    constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
    }

    observe(element: DOMElement): void {
        if (this.observedElements.has(element)) {
            return;
        }

        this.observedElements.add(element);
        element.resizeObservers ??= new Set();
        element.resizeObservers.add(this);

        let lastMeasuredSize = element.internal_lastMeasuredSize;

        if (lastMeasuredSize === undefined && element.yogaNode) {
            const width = Math.round(element.yogaNode.getComputedWidth());
            const height = Math.round(element.yogaNode.getComputedHeight());

            // Avoid spurious measurements when layout isn't available (NaN != NaN causes bugs)
            if (!Number.isNaN(width) && !Number.isNaN(height)) {
                lastMeasuredSize = { height, width };
                element.internal_lastMeasuredSize = lastMeasuredSize;
            }
        }

        if (lastMeasuredSize) {
            const entry = new ResizeObserverEntry(element, lastMeasuredSize);

            try {
                this.callback([entry], this);
            } catch (error) {
                console.error(error);
            }
        }
    }

    unobserve(element: DOMElement): void {
        this.observedElements.delete(element);
        element.resizeObservers?.delete(this);
    }

    disconnect(): void {
        for (const element of this.observedElements) {
            element.resizeObservers?.delete(this);
        }

        this.observedElements.clear();
    }

    /**
     * Internal method called by the layout engine after computing layout.
     */
    internalTrigger(entries: ResizeObserverEntry[]): void {
        try {
            this.callback(entries, this);
        } catch (error) {
            console.error(error);
        }
    }
}

/**
 * Measure a node and collect resize observer entries for it.
 * Used by both the main render loop and static render processing.
 */
export function measureAndExtractObservers(node: DOMElement, observerEntries: Map<ResizeObserver, ResizeObserverEntry[]>, forceCache = false): void {
    const hasObservers = node.resizeObservers && node.resizeObservers.size > 0;

    if ((hasObservers || forceCache) && node.yogaNode) {
        const width = Math.round(node.yogaNode.getComputedWidth());
        const height = Math.round(node.yogaNode.getComputedHeight());

        if (!Number.isNaN(width) && !Number.isNaN(height)) {
            const lastSize = node.internal_lastMeasuredSize;

            if (lastSize?.width !== width || lastSize.height !== height) {
                node.internal_lastMeasuredSize = { height, width };

                if (hasObservers) {
                    const entry = new ResizeObserverEntry(node, { height, width });

                    for (const observer of node.resizeObservers!) {
                        if (!observerEntries.has(observer)) {
                            observerEntries.set(observer, []);
                        }

                        observerEntries.get(observer)!.push(entry);
                    }
                }
            }
        }
    }
}

export default ResizeObserver;
