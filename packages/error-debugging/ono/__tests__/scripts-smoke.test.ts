import vm from "node:vm";

import { describe, expect, it } from "vitest";

import template from "../src/error-inspector";

const SCRIPT_TAG_RE = /<script\b[^>]*>([\s\S]*?)<\/script>/g;

const extractScripts = (html: string): string[] => {
    const scripts: string[] = [];
    let match: RegExpExecArray | null;

    // eslint-disable-next-line no-cond-assign
    while ((match = SCRIPT_TAG_RE.exec(html)) !== null) {
        const content = match[1]?.trim();

        if (content) {
            scripts.push(content);
        }
    }

    return scripts;
};

type Listener = (event: unknown) => void;

interface FakeNode {
    addEventListener: (type: string, fn: Listener) => void;
    classList: {
        add: (...classes: string[]) => void;
        contains: (className: string) => boolean;
        remove: (...classes: string[]) => void;
        toggle: (className: string) => boolean;
    };
    click: () => void;
    closest: (selector: string) => FakeNode | null;
    dataset: Record<string, string>;
    dispatch: (type: string, event: unknown) => void;
    focus: () => void;
    getAttribute: (name: string) => string | undefined;
    getBoundingClientRect: () => Record<string, number>;
    offsetHeight: number;
    querySelector: () => null;
    querySelectorAll: () => FakeNode[];
    removeEventListener: (type: string, fn: Listener) => void;
    scrollHeight: number;
    setAttribute: (name: string, value: string) => void;
    style: Record<string, string>;
}

const makeNode = (initialClasses: string[] = []): FakeNode => {
    const classes = new Set(initialClasses);
    const listeners: Record<string, Listener[]> = {};
    const attributes: Record<string, string> = {};

    const node: FakeNode = {
        addEventListener: (type, fn) => {
            (listeners[type] ??= []).push(fn);
        },
        classList: {
            add: (...c) => c.forEach((x) => classes.add(x)),
            contains: (c) => classes.has(c),
            remove: (...c) => c.forEach((x) => classes.delete(x)),
            toggle: (c) => {
                if (classes.has(c)) {
                    classes.delete(c);

                    return false;
                }

                classes.add(c);

                return true;
            },
        },
        click: () => node.dispatch("click", { preventDefault: () => {}, target: node }),
        closest: () => null,
        dataset: {},
        dispatch: (type, event) => {
            [...(listeners[type] ?? [])].forEach((fn) => fn(event));
        },
        focus: () => {},
        getAttribute: (name) => attributes[name],
        getBoundingClientRect: () => ({ bottom: 0, height: 0, left: 0, right: 0, top: 0, width: 0 }),
        offsetHeight: 0,
        querySelector: () => null,
        querySelectorAll: () => [],
        removeEventListener: (type, fn) => {
            listeners[type] = (listeners[type] ?? []).filter((f) => f !== fn);
        },
        scrollHeight: 0,
        setAttribute: (name, value) => {
            attributes[name] = value;
        },
        style: {},
    };

    return node;
};

// A DOM shim just rich enough to *execute* the emitted client scripts (other lookups resolve to null/[],
// which the scripts guard against), so the test observes real behaviour rather than string contents.
// `window` is the sandbox itself, mirroring the browser where `window === globalThis`, so a script that
// assigns `window.bindShortcutsModal` exposes a bare `bindShortcutsModal` global to later <script> tags.
const buildContext = (): { context: vm.Context; documentObject: FakeNode & { dispatch: (type: string, event: unknown) => void }; modal: FakeNode } => {
    const modal = makeNode(["fixed", "inset-0", "hidden"]);
    const openButton = makeNode();
    const closeButton = makeNode();
    const documentListeners: Record<string, Listener[]> = {};

    const documentObject = {
        addEventListener: (type: string, fn: Listener) => {
            (documentListeners[type] ??= []).push(fn);
        },
        body: makeNode(),
        dispatch: (type: string, event: unknown) => {
            [...(documentListeners[type] ?? [])].forEach((fn) => fn(event));
        },
        documentElement: makeNode(),
        getElementById: (id: string) => (id === "ono-shortcuts-modal" ? modal : null),
        querySelector: () => null,
        querySelectorAll: (selector: string) => {
            if (selector.includes("open-shortcuts-modal")) {
                return [openButton];
            }

            if (selector.includes("close-shortcuts-modal")) {
                return [closeButton];
            }

            return [];
        },
        readyState: "complete",
        removeEventListener: () => {},
    };

    const sandbox: Record<string, unknown> = {
        addEventListener: () => {},
        console: { debug: () => {}, error: () => {}, log: () => {}, warn: () => {} },
        document: documentObject,
        Event: function Event(this: Record<string, unknown>, type: string) {
            this.type = type;
        },
        innerHeight: 768,
        innerWidth: 1024,
        localStorage: { getItem: () => null, setItem: () => {} },
        matchMedia: () => ({ addEventListener: () => {}, addListener: () => {}, matches: false, removeEventListener: () => {} }),
        MutationObserver: class {
            public disconnect(): void {}

            public observe(): void {}

            public takeRecords(): unknown[] {
                return [];
            }
        },
        navigator: { clipboard: { writeText: () => Promise.resolve() } },
        removeEventListener: () => {},
        setTimeout: () => 0,
    };

    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;

    return { context: vm.createContext(sandbox), documentObject: documentObject as unknown as FakeNode & { dispatch: (type: string, event: unknown) => void }, modal };
};

describe("generated client scripts", () => {
    it("all <script> tags execute in one shared realm without throwing", { timeout: 30_000 }, async () => {
        expect.assertions(2);

        const html = await template(new Error("boom"), []);
        const scripts = extractScripts(html);

        expect(scripts.length).toBeGreaterThan(3);

        const { context } = buildContext();

        // Each classic <script> is its own program sharing the global lexical environment — this reproduces
        // a duplicate top-level `const` (the historical page-wide SyntaxError) exactly as a browser would.
        expect(() => {
            scripts.forEach((source) => {
                vm.runInContext(source, context);
            });
        }).not.toThrow();
    });

    it("renders exactly one shortcuts modal and wires '?' to open and Escape to close it", { timeout: 30_000 }, async () => {
        expect.assertions(4);

        const html = await template(new Error("boom"), []);
        // Build the needle from parts so this test file's own source never contains the modal id
        // attribute verbatim: the error's code frame renders this file into the page, and a literal
        // match would otherwise inflate the count with a coincidental substring.
        const modalIdAttribute = `id="${["ono", "shortcuts", "modal"].join("-")}"`;
        const modalCount = html.split(modalIdAttribute).length - 1;

        expect(modalCount).toBe(1);

        const scripts = extractScripts(html);
        const { context, documentObject, modal } = buildContext();

        scripts.forEach((source) => {
            vm.runInContext(source, context);
        });

        // Real keydown events always carry a `target`; header-tab navigation reads `e.target.closest`.
        documentObject.dispatch("keydown", { key: "?", preventDefault: () => {}, shiftKey: false, target: makeNode() });

        expect(modal.classList.contains("hidden")).toBe(false);
        expect(modal.classList.contains("flex")).toBe(true);

        documentObject.dispatch("keydown", { key: "Escape", preventDefault: () => {}, shiftKey: false, target: makeNode() });

        expect(modal.classList.contains("hidden")).toBe(true);
    });
});
