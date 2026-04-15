/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/prefer-nullish-coalescing, import/no-mutable-exports, jsdoc/match-description, no-bitwise, sonarjs/no-nested-conditional, sonarjs/redundant-type-aliases, unicorn/no-null, unused-imports/no-unused-vars */
// @ts-nocheck
import { createContext } from "react";
import ReactReconciler from "react-reconciler";
import { DefaultEventPriority, DiscreteEventPriority, NoEventPriority } from "react-reconciler/constants";
import { unstable_cancelCallback, unstable_now, unstable_scheduleCallback, unstable_shouldYield } from "scheduler";

import { LayoutNode } from "./layout";
import type { Styles } from "./styles";
import { applyStyles, resolveColor } from "./styles";
import { getStringWidth } from "./text-width";

type Type = "box" | "ink-box" | "ink-text" | "text";
type Props = any;
type Container = LayoutNode;
type Instance = LayoutNode;
type TextInstance = LayoutNode;
type SuspenseInstance = any;
type HydratableInstance = any;
type PublicInstance = any;
type HostContext = any;
type UpdatePayload = any;
type ChildSet = any;
type TimeoutHandle = any;
type NoTimeout = any;

type TransitionStatus = any;

export let onAfterCommit: (() => void) | null = null;
export function setOnAfterCommit(function_: (() => void) | null): void {
    onAfterCommit = function_;
}

let currentUpdatePriority = NoEventPriority;

/**
 * Resolve Ink-compatible color/style props into the native renderer's numeric fg/bg/styles values.
 * Ink uses: color="green", backgroundColor="red", bold, italic, dim, underline, etc.
 * Native renderer uses: fg=&lt;ansi-index>, bg=&lt;ansi-index>, styles=&lt;bitfield>
 */
function resolveNodeColors(props: Props): { bg: number; fg: number; styles: number } {
    // fg: explicit numeric fg > color prop > 255 (terminal default)
    const fg = resolveColor(props.fg === undefined ? props.color === undefined ? undefined : props.color : props.fg);

    // bg: explicit numeric bg > backgroundColor prop > 255 (terminal default)
    const bg = resolveColor(props.bg === undefined ? props.backgroundColor === undefined ? undefined : props.backgroundColor : props.bg);

    // styles bitfield — explicit number overrides, otherwise build from boolean props
    let styles: number;

    if (props.styles === undefined) {
        styles = 0;

        if (props.bold) {
            styles |= 1;
        }

        if (props.dim || props.dimColor) {
            styles |= 2;
        }

        if (props.italic) {
            styles |= 4;
        }

        if (props.underline) {
            styles |= 8;
        }

        if (props.blink) {
            styles |= 16;
        }

        if (props.inverse) {
            styles |= 32;
        }

        if (props.hidden) {
            styles |= 64;
        }

        if (props.strikethrough) {
            styles |= 128;
        }
    } else {
        styles = props.styles;
    }

    return { bg, fg, styles };
}

const hostConfig: ReactReconciler.HostConfig<
    Type,
    Props,
    Container,
    Instance,
    TextInstance,
    SuspenseInstance,
    HydratableInstance,
    PublicInstance,
    HostContext,
    UpdatePayload,
    ChildSet,
    TimeoutHandle,
    NoTimeout,
    TransitionStatus
> = {
    afterActiveInstanceBlur: () => {},
    appendChild(parentInstance, child) {
        parentInstance.insertChild(child, parentInstance.children.length);
    },
    appendChildToContainer(container, child) {
        container.insertChild(child, container.children.length);
    },
    appendInitialChild(parentInstance, child) {
        parentInstance.insertChild(child, parentInstance.children.length);
    },

    beforeActiveInstanceBlur: () => {},

    cancelCallback: unstable_cancelCallback,

    cancelTimeout: clearTimeout,

    clearContainer(container: any) {},

    commitTextUpdate(textInstance, oldText, newText) {
        textInstance.text = newText;
        // The text setter installs a measure function that handles wrapping.
        // Do NOT call setWidth() here — it overrides the measure function and
        // prevents Yoga from re-measuring text that needs to wrap.
        textInstance.yogaNode.markDirty();
    },

    commitUpdate(instance, type, previousProps, nextProps, internalHandle) {
        // Re-apply Yoga styles on update (React 19 signature: instance, type, oldProps, newProps, fiber)
        // Pass nextProps as currentStyle so applyBorderStyles computes border
        // width from the NEW state, not the previous one.
        applyStyles(instance.yogaNode, nextProps as Styles);

        // Re-resolve color/style props
        const { bg, fg, styles } = resolveNodeColors(nextProps);

        instance.fg = fg;
        instance.bg = bg;
        instance.styles = styles;
        instance._style = nextProps;

        // Update transform prop
        instance.transform = typeof nextProps.transform === "function" ? nextProps.transform : undefined;
    },

    createInstance(type, props, rootContainer, hostContext, internalHandle) {
        const node = new LayoutNode();

        // Apply Yoga styles — match CSS defaults (unlike Yoga's defaults):
        //   flexDirection: 'row'  (Yoga default: 'column')
        //   flexShrink: 1         (Yoga default: 0 — causes flexGrow boxes to overflow their parent)
        const stylesToApply: Styles = { ...props };

        if (stylesToApply.flexDirection === undefined) {
            stylesToApply.flexDirection = "row";
        }

        if (stylesToApply.flexShrink === undefined) {
            stylesToApply.flexShrink = 1;
        }

        applyStyles(node.yogaNode, stylesToApply);

        // Resolve color/style props (Ink-compat + native)
        const { bg, fg, styles } = resolveNodeColors(props);

        node.fg = fg;
        node.bg = bg;
        node.styles = styles;
        node._style = props;

        // Transform prop — used by <Transform> component
        if (typeof props.transform === "function") {
            node.transform = props.transform;
        }

        return node;
    },

    createTextInstance(text, rootContainer, hostContext, internalHandle) {
        const node = new LayoutNode();

        node.text = text;
        // Text nodes shouldn't expand like block elements in standard HTML,
        // but in terminal we let parent constraints apply and seed a natural width.
        node.yogaNode.setWidth(getStringWidth(text));
        node.yogaNode.setHeight(1);

        return node;
    },

    detachDeletedInstance: (instance: LayoutNode) => {
        instance.destroy();
    },

    finalizeInitialChildren(instance: any, type: any, props: any, rootContainer: any, hostContext: any) {
        return false;
    },

    getChildHostContext(parentHostContext, type, rootContainer) {
        return { isInsideText: type === "text" };
    },

    getCurrentEventPriority: () => DiscreteEventPriority,

    getCurrentUpdatePriority: () => currentUpdatePriority,

    getInstanceFromNode: () => null,

    getPublicInstance(instance) {
        return instance;
    },

    getRootHostContext(rootContainer) {
        return { isInsideText: false };
    },
    // Suspense visibility — called when a Suspense boundary hides/reveals children.
    // In a terminal renderer there's no DOM visibility concept; we just mark the node
    // and let the next render pass skip or include it naturally.
    hideInstance(instance: LayoutNode) {
        instance._hidden = true;
    },
    hideTextInstance(instance: LayoutNode) {
        instance._hidden = true;
    },
    HostTransitionContext: createContext(null) as any,

    insertBefore(parentInstance, child, beforeChild) {
        // Remove child from its current owner BEFORE computing indexOf(beforeChild).
        // Same-parent reorders shift the array, so we must get the index after removal.
        if (child.parent) {
            child.remove();
        }

        const index = parentInstance.children.indexOf(beforeChild);

        parentInstance.insertChild(child, index);
    },
    isPrimaryRenderer: true,
    maySuspendCommit: () => true,
    noTimeout: -1,

    NotPendingTransition: undefined,
    now: unstable_now,
    preloadInstance: () => true,

    prepareForCommit(containerInfo) {
        return null;
    },
    preparePortalMount: () => {},
    prepareScopeUpdate: () => {},
    prepareUpdate(instance, type, oldProps, newProps, rootContainer, hostContext) {
        // Return null if props haven't changed — tells React to skip commitUpdate
        // for this node. This is critical for performance: returning true always
        // causes React to enqueue a fiber update for every node every frame,
        // leading to unbounded memory growth under high-frequency renders.
        const oldKeys = Object.keys(oldProps).filter((k) => k !== "children");
        const newKeys = Object.keys(newProps).filter((k) => k !== "children");

        if (oldKeys.length !== newKeys.length) {
            return true;
        }

        for (const key of newKeys) {
            if (oldProps[key] !== newProps[key]) {
                return true;
            }
        }

        return null;
    },
    removeChild(parentInstance, child) {
        child.remove();
    },

    removeChildFromContainer(container, child) {
        child.remove();
    },
    requestPostPaintCallback: () => {},

    resetAfterCommit(containerInfo: any) {
        if (typeof onAfterCommit === "function") {
            onAfterCommit();
        }
    },
    resolveEventTimeStamp: () => -1.1,
    resolveEventType: () => null,
    resolveUpdatePriority() {
        if (currentUpdatePriority !== NoEventPriority) {
            return currentUpdatePriority;
        }

        return DefaultEventPriority;
    },
    scheduleCallback: unstable_scheduleCallback,
    scheduleMicrotask: queueMicrotask,
    scheduleTimeout: setTimeout,
    setCurrentUpdatePriority(newPriority: any) {
        currentUpdatePriority = newPriority;
    },
    shouldAttemptEagerTransition: () => false,
    shouldSetTextContent(type: any, props: any) {
        return false;
    },
    shouldYield: unstable_shouldYield,
    startSuspendingCommit: () => {},
    supportsHydration: false,
    supportsMicrotasks: true,
    supportsMutation: true,
    supportsPersistence: false,
    suspendInstance: () => {},
    trackSchedulerEvent: () => {},
    unhideInstance(instance: LayoutNode, _props: any) {
        instance._hidden = false;
    },
    unhideTextInstance(instance: LayoutNode, _text: string) {
        instance._hidden = false;
    },
    waitForCommitToBeReady: () => null,
    warnsIfNotActing: true,
} as any;

export const TuiReconciler: ReturnType<typeof ReactReconciler> = ReactReconciler(hostConfig);
