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
            const width = element.yogaNode.getComputedWidth();
            const height = element.yogaNode.getComputedHeight();

            lastMeasuredSize = { height, width };
            element.internal_lastMeasuredSize = lastMeasuredSize;
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

export default ResizeObserver;
