/* eslint-disable @typescript-eslint/no-unnecessary-condition, @typescript-eslint/prefer-nullish-coalescing, consistent-return, no-console, no-empty, unicorn/no-null */
import process from "node:process";

import { createContext, version as reactVersion } from "react";
import type { ReactContext } from "react-reconciler";
import createReconciler from "react-reconciler";
import { DefaultEventPriority, NoEventPriority } from "react-reconciler/constants";
import { unstable_cancelCallback, unstable_now, unstable_scheduleCallback, unstable_shouldYield } from "scheduler";
import Yoga from "yoga-layout";

import type { CursorMarker, DOMElement, DOMNode, DOMNodeAttribute, ElementNames, TextNode } from "./dom";
import {
    appendChildNode,
    createNode,
    createTextNode,
    emitLayoutListeners,
    insertBeforeNode,
    markNodeAsDirty,
    removeChildNode,
    setAttribute,
    setStyle,
    setTextNodeValue,
} from "./dom";
import type { Region } from "./region";
import type { OutputTransformer } from "./render-node-to-output";
import type { Styles } from "./styles";
import applyStyles from "./styles";

// We need to conditionally perform devtools connection to avoid
// accidentally breaking other third-party code.
// See https://github.com/vadimdemedes/ink/issues/384
// See https://github.com/vadimdemedes/ink/issues/648
if (process.env["DEV"] === "true") {
    // Intentionally no warning when the package is missing.
    // DEV may be set for other reasons; devtools is opt-in via installing the package.
    let isDevtoolsInstalled = false;

    try {
        import.meta.resolve("react-devtools-core");
        isDevtoolsInstalled = true;
    } catch {}

    if (isDevtoolsInstalled) {
        await import("./devtools.js");
    }
}

type AnyObject = Record<string, unknown>;

const diff = (before: AnyObject, after: AnyObject): AnyObject | undefined => {
    if (before === after) {
        return;
    }

    if (!before) {
        return after;
    }

    const changed: AnyObject = {};
    let isChanged = false;

    for (const key of Object.keys(before)) {
        const isDeleted = after ? !Object.hasOwn(after, key) : true;

        if (isDeleted) {
            changed[key] = undefined;
            isChanged = true;
        }
    }

    if (after) {
        for (const key of Object.keys(after)) {
            if (after[key] !== before[key]) {
                changed[key] = after[key];
                isChanged = true;
            }
        }
    }

    return isChanged ? changed : undefined;
};

/**
 * Recursively clean up a node tree, freeing Yoga nodes, clearing
 * resize observers, and resetting references to prevent memory leaks.
 *
 * Ported from jacob314/ink fork (Google LLC, Apache-2.0).
 */
const cleanupNodeTree = (node?: DOMNode): void => {
    if (!node) {
        return;
    }

    node.yogaNode?.unsetMeasureFunc();

    if ("resizeObservers" in node) {
        node.resizeObservers?.clear();
    }

    if ("childNodes" in node && node.childNodes) {
        for (const child of node.childNodes) {
            cleanupNodeTree(child);
        }
    }

    node.yogaNode?.free();

    if ("cachedRender" in node) {
        node.cachedRender = undefined;
    }

    if ("childNodes" in node) {
        node.childNodes = [];
    }

    node.parentNode = undefined;
};

type Props = Record<string, unknown>;

type HostContext = {
    isInsideText: boolean;
};

let currentUpdatePriority = NoEventPriority;

let currentRootNode: DOMElement | undefined;

async function loadPackageJson() {
    const fs = await import("node:fs");
    const content = fs.readFileSync(new URL("../package.json", import.meta.url), "utf8");

    const parsedContent = JSON.parse(content) as
        | {
              name?: string;
              version?: string;
          }
        | undefined;

    return {
        name: parsedContent?.name,
        version: parsedContent?.version,
    };
}

let packageInfo = {
    name: "ink",
    version: reactVersion,
};

if (process.env["DEV"] === "true") {
    try {
        const loaded = await loadPackageJson();

        packageInfo = {
            name: loaded.name || packageInfo.name,

            version: loaded.version || packageInfo.version,
        };
    } catch (error) {
        console.warn("Failed to load package.json in development mode. Falling back to default renderer metadata.", error);
    }
}

const reconcilerInstance: ReturnType<typeof createReconciler> = createReconciler<
    ElementNames,
    Props,
    DOMElement,
    DOMElement,
    TextNode,
    DOMElement,
    unknown,
    unknown,
    unknown,
    HostContext,
    unknown,
    unknown,
    unknown,
    unknown
>({
    afterActiveInstanceBlur() {},
    appendChild: appendChildNode,
    appendChildToContainer: appendChildNode,
    appendInitialChild: appendChildNode,
    beforeActiveInstanceBlur() {},
    // @ts-expect-error cancelCallback is not in @types/react-reconciler but required at runtime
    cancelCallback: unstable_cancelCallback,
    cancelTimeout: clearTimeout,
    clearContainer: () => false,
    commitTextUpdate(node, _oldText, newText) {
        setTextNodeValue(node, newText);
    },
    commitUpdate(node, _type, oldProps, newProps) {
        if (currentRootNode && node.internal_static) {
            currentRootNode.isStaticDirty = true;
        }

        const props = diff(oldProps, newProps);

        const style = diff(oldProps["style"] as Styles, newProps["style"] as Styles);

        if (!props && !style) {
            return;
        }

        let shouldMarkDirty = Boolean(style);

        if (props) {
            for (const [key, value] of Object.entries(props)) {
                if (key === "children") {
                    continue;
                }

                if (key === "style") {
                    setStyle(node, value as Styles);
                    continue;
                }

                if (key === "internal_transform") {
                    node.internal_transform = value as OutputTransformer;
                    shouldMarkDirty = true;
                    continue;
                }

                if (key === "internal_cursor") {
                    node.internal_cursor = value as CursorMarker;
                    shouldMarkDirty = true;
                    continue;
                }

                if (key === "internal_static") {
                    node.internal_static = true;
                    shouldMarkDirty = true;
                    continue;
                }

                if (key === "sticky") {
                    node.internal_sticky = value as boolean | "top" | "bottom";
                    shouldMarkDirty = true;
                    continue;
                }

                if (key === "internalStickyAlternate") {
                    node.internal_stickyAlternate = value as boolean;
                    shouldMarkDirty = true;
                    continue;
                }

                if (key === "opaque") {
                    node.internal_opaque = value as boolean;
                    shouldMarkDirty = true;
                    continue;
                }

                if (key === "scrollbar") {
                    node.internal_scrollbar = value as boolean;
                    shouldMarkDirty = true;
                    continue;
                }

                if (key === "internal_terminalCursorFocus") {
                    node.internal_terminalCursorFocus = value as boolean;
                    shouldMarkDirty = true;
                    continue;
                }

                if (key === "internal_terminalCursorPosition") {
                    node.internal_terminalCursorPosition = value as number;
                    shouldMarkDirty = true;
                    continue;
                }

                if (key === "cachedRender") {
                    node.cachedRender = value as Region;
                    shouldMarkDirty = true;
                    continue;
                }

                setAttribute(node, key, value as DOMNodeAttribute);
                shouldMarkDirty = true;
            }
        }

        if (style && node.yogaNode) {
            applyStyles(node.yogaNode, style, (newProps["style"] as Styles | undefined) ?? {});
        }

        if (shouldMarkDirty) {
            markNodeAsDirty(node);
        }
    },
    createInstance(originalType, newProps, rootNode, hostContext) {
        if (hostContext.isInsideText && originalType === "ink-box") {
            throw new Error(`<Box> can’t be nested inside <Text> component`);
        }

        if (hostContext.isInsideText && originalType === "ink-cursor") {
            throw new Error(`<Cursor> can’t be nested inside <Text> component`);
        }

        const type = originalType === "ink-text" && hostContext.isInsideText ? "ink-virtual-text" : originalType;

        const node = createNode(type);

        for (const [key, value] of Object.entries(newProps)) {
            if (key === "children") {
                continue;
            }

            if (key === "style") {
                setStyle(node, value as Styles);

                if (node.yogaNode) {
                    applyStyles(node.yogaNode, value as Styles);
                }

                continue;
            }

            if (key === "internal_transform") {
                node.internal_transform = value as OutputTransformer;
                continue;
            }

            if (key === "internal_cursor") {
                node.internal_cursor = value as CursorMarker;
                continue;
            }

            if (key === "internal_static") {
                currentRootNode = rootNode;
                node.internal_static = true;
                rootNode.isStaticDirty = true;

                // Save reference to <Static> node to skip traversal of entire
                // node tree to find it
                rootNode.staticNode = node;
                continue;
            }

            if (key === "sticky") {
                node.internal_sticky = value as boolean | "top" | "bottom";
                continue;
            }

            if (key === "internalStickyAlternate") {
                node.internal_stickyAlternate = value as boolean;
                continue;
            }

            if (key === "opaque") {
                node.internal_opaque = value as boolean;
                continue;
            }

            if (key === "scrollbar") {
                node.internal_scrollbar = value as boolean;
                continue;
            }

            if (key === "internal_terminalCursorFocus") {
                node.internal_terminalCursorFocus = value as boolean;
                continue;
            }

            if (key === "internal_terminalCursorPosition") {
                node.internal_terminalCursorPosition = value as number;
                continue;
            }

            if (key === "internal_static") {
                node.internal_static = true;
                continue;
            }

            if (key === "cachedRender") {
                node.cachedRender = value as Region;
                continue;
            }

            setAttribute(node, key, value as DOMNodeAttribute);
        }

        return node;
    },
    createTextInstance(text, _root, hostContext) {
        if (!hostContext.isInsideText) {
            throw new Error(`Text string "${text}" must be rendered inside <Text> component`);
        }

        return createTextNode(text);
    },
    detachDeletedInstance() {},
    finalizeInitialChildren() {
        return false;
    },
    getChildHostContext(parentHostContext, type) {
        const previousIsInsideText = parentHostContext.isInsideText;
        const isInsideText = type === "ink-text" || type === "ink-virtual-text";

        if (previousIsInsideText === isInsideText) {
            return parentHostContext;
        }

        return { isInsideText };
    },
    getCurrentUpdatePriority: () => currentUpdatePriority,
    getInstanceFromNode: () => null,
    getInstanceFromScope: () => null,
    getPublicInstance: (instance) => instance,
    getRootHostContext: () => {
        return {
            isInsideText: false,
        };
    },
    hideInstance(node) {
        node.internal_hidden = true;
        node.yogaNode?.setDisplay(Yoga.DISPLAY_NONE);
        markNodeAsDirty(node);
    },
    hideTextInstance(node) {
        setTextNodeValue(node, "");
    },

    HostTransitionContext: createContext(null) as unknown as ReactContext<unknown>,
    insertBefore: insertBeforeNode,
    insertInContainerBefore: insertBeforeNode,
    isPrimaryRenderer: true,
    maySuspendCommit() {
        // Return true to enable Suspense resource preloading
        return true;
    },
    noTimeout: -1,

    NotPendingTransition: undefined,
    now: unstable_now,
    preloadInstance() {
        return true;
    },
    prepareForCommit: () => null,
    preparePortalMount: () => null,
    prepareScopeUpdate() {},
    removeChild(node, removeNode) {
        removeChildNode(node, removeNode);
        cleanupNodeTree(removeNode);
    },
    removeChildFromContainer(node, removeNode) {
        removeChildNode(node, removeNode);
        cleanupNodeTree(removeNode);
    },
    rendererPackageName: packageInfo.name,
    rendererVersion: packageInfo.version,
    requestPostPaintCallback() {},
    resetAfterCommit(rootNode) {
        if (typeof rootNode.onComputeLayout === "function") {
            rootNode.onComputeLayout();
        }

        emitLayoutListeners(rootNode);

        // Since renders are throttled at the instance level and <Static> component children
        // are rendered only once and then get deleted, we need an escape hatch to
        // trigger an immediate render to ensure <Static> children are written to output before they get erased
        if (rootNode.isStaticDirty) {
            rootNode.isStaticDirty = false;

            if (typeof rootNode.onImmediateRender === "function") {
                rootNode.onImmediateRender();
            }

            return;
        }

        if (typeof rootNode.onRender === "function") {
            rootNode.onRender();
        }
    },
    resetFormInstance() {},
    resetTextContent() {},
    resolveEventTimeStamp() {
        return -1.1;
    },
    resolveEventType() {
        return null;
    },
    resolveUpdatePriority() {
        if (currentUpdatePriority !== NoEventPriority) {
            return currentUpdatePriority;
        }

        return DefaultEventPriority;
    },
    scheduleCallback: unstable_scheduleCallback,
    scheduleMicrotask: queueMicrotask,
    scheduleTimeout: setTimeout,
    setCurrentUpdatePriority(newPriority: number) {
        currentUpdatePriority = newPriority;
    },
    shouldAttemptEagerTransition() {
        return false;
    },
    shouldSetTextContent: () => false,
    shouldYield: unstable_shouldYield,
    startSuspendingCommit() {},
    supportsHydration: false,
    // Scheduler integration for concurrent mode
    supportsMicrotasks: true,
    supportsMutation: true,
    supportsPersistence: false,
    suspendInstance() {},
    trackSchedulerEvent() {},
    unhideInstance(node) {
        node.internal_hidden = false;
        node.yogaNode?.setDisplay(Yoga.DISPLAY_FLEX);
        markNodeAsDirty(node);
    },
    unhideTextInstance(node, text) {
        setTextNodeValue(node, text);
    },
    waitForCommitToBeReady() {
        return null;
    },
});

export default reconcilerInstance;
