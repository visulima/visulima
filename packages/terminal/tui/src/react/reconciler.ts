// @ts-nocheck
import ReactReconciler from "react-reconciler";
import { DefaultEventPriority, DiscreteEventPriority, NoEventPriority } from "react-reconciler/constants.js";
import * as Scheduler from "scheduler";
import { createContext } from "react";
import { LayoutNode } from "./layout.js";
import { applyStyles, resolveColor, Styles } from "./styles.js";
import { getStringWidth } from "./text-width.js";
import Yoga from "yoga-layout-prebuilt";

type Type = "box" | "text";
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
export function setOnAfterCommit(fn: (() => void) | null): void {
    onAfterCommit = fn;
}

let currentUpdatePriority = NoEventPriority;

/**
 * Resolve Ink-compatible color/style props into ratatat's numeric fg/bg/styles values.
 * Ink uses: color="green", backgroundColor="red", bold, italic, dim, underline, etc.
 * Ratatat uses: fg=<ansi-index>, bg=<ansi-index>, styles=<bitfield>
 */
function resolveNodeColors(props: Props): { fg: number; bg: number; styles: number } {
    // fg: explicit numeric fg > color prop > 255 (terminal default)
    const fg = resolveColor(props.fg !== undefined ? props.fg : props.color !== undefined ? props.color : undefined);

    // bg: explicit numeric bg > backgroundColor prop > 255 (terminal default)
    const bg = resolveColor(props.bg !== undefined ? props.bg : props.backgroundColor !== undefined ? props.backgroundColor : undefined);

    // styles bitfield — explicit number overrides, otherwise build from boolean props
    let styles: number;
    if (props.styles !== undefined) {
        styles = props.styles;
    } else {
        styles = 0;
        if (props.bold) styles |= 1;
        if (props.dim || props.dimColor) styles |= 2;
        if (props.italic) styles |= 4;
        if (props.underline) styles |= 8;
        if (props.blink) styles |= 16;
        if (props.inverse) styles |= 32;
        if (props.hidden) styles |= 64;
        if (props.strikethrough) styles |= 128;
    }

    return { fg, bg, styles };
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
    supportsMutation: true,
    supportsPersistence: false,
    supportsHydration: false,
    isPrimaryRenderer: true,

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

        // Resolve color/style props (Ink-compat + ratatat-native)
        const { fg, bg, styles } = resolveNodeColors(props);
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

    appendInitialChild(parentInstance, child) {
        parentInstance.insertChild(child, parentInstance.children.length);
    },

    appendChild(parentInstance, child) {
        parentInstance.insertChild(child, parentInstance.children.length);
    },

    appendChildToContainer(container, child) {
        container.insertChild(child, container.children.length);
    },

    removeChild(parentInstance, child) {
        parentInstance.removeChild(child);
    },

    removeChildFromContainer(container, child) {
        container.removeChild(child);
    },

    insertBefore(parentInstance, child, beforeChild) {
        // Remove child from its current owner BEFORE computing indexOf(beforeChild).
        // Same-parent reorders shift the array, so we must get the index after removal.
        if (child.parent) child.parent.removeChild(child);
        const index = parentInstance.children.indexOf(beforeChild);
        parentInstance.insertChild(child, index);
    },

    prepareUpdate(instance, type, oldProps, newProps, rootContainer, hostContext) {
        // Return null if props haven't changed — tells React to skip commitUpdate
        // for this node. This is critical for performance: returning true always
        // causes React to enqueue a fiber update for every node every frame,
        // leading to unbounded memory growth under high-frequency renders.
        const oldKeys = Object.keys(oldProps).filter((k) => k !== "children");
        const newKeys = Object.keys(newProps).filter((k) => k !== "children");
        if (oldKeys.length !== newKeys.length) return true;
        for (const key of newKeys) {
            if (oldProps[key] !== newProps[key]) return true;
        }
        return null;
    },

    commitUpdate(instance, type, prevProps, nextProps, internalHandle) {
        // Re-apply Yoga styles on update (React 19 signature: instance, type, oldProps, newProps, fiber)
        applyStyles(instance.yogaNode, nextProps as Styles, prevProps as Styles);

        // Re-resolve color/style props
        const { fg, bg, styles } = resolveNodeColors(nextProps);
        instance.fg = fg;
        instance.bg = bg;
        instance.styles = styles;
        instance._style = nextProps;

        // Update transform prop
        instance.transform = typeof nextProps.transform === "function" ? nextProps.transform : undefined;
    },

    commitTextUpdate(textInstance, oldText, newText) {
        textInstance.text = newText;
        textInstance.yogaNode.setWidth(getStringWidth(newText));
    },

    getRootHostContext(rootContainer) {
        return { isInsideText: false };
    },

    getChildHostContext(parentHostContext, type, rootContainer) {
        return { isInsideText: type === "text" };
    },

    getPublicInstance(instance) {
        return instance;
    },

    prepareForCommit(containerInfo) {
        return null;
    },

    resetAfterCommit(containerInfo: any) {
        if (typeof onAfterCommit === "function") onAfterCommit();
    },
    shouldSetTextContent(type: any, props: any) {
        return false;
    },
    clearContainer(container: any) {},
    finalizeInitialChildren(instance: any, type: any, props: any, rootContainer: any, hostContext: any) {
        return false;
    },

    // Suspense visibility — called when a Suspense boundary hides/reveals children.
    // In a terminal renderer there's no DOM visibility concept; we just mark the node
    // and let the next render pass skip or include it naturally.
    hideInstance(instance: LayoutNode) {
        instance._hidden = true;
    },
    unhideInstance(instance: LayoutNode, _props: any) {
        instance._hidden = false;
    },
    hideTextInstance(_instance: any) {},
    unhideTextInstance(_instance: any, _text: string) {},

    scheduleTimeout: setTimeout,
    cancelTimeout: clearTimeout,
    noTimeout: -1,

    scheduleMicrotask: queueMicrotask,
    scheduleCallback: Scheduler.unstable_scheduleCallback,
    cancelCallback: Scheduler.unstable_cancelCallback,
    shouldYield: Scheduler.unstable_shouldYield,
    now: Scheduler.unstable_now,

    warnsIfNotActing: true,
    supportsMicrotasks: true,

    getInstanceFromNode: () => null,
    beforeActiveInstanceBlur: () => {},
    afterActiveInstanceBlur: () => {},
    preparePortalMount: () => {},
    prepareScopeUpdate: () => {},
    getCurrentEventPriority: () => DiscreteEventPriority,
    setCurrentUpdatePriority(newPriority: any) {
        currentUpdatePriority = newPriority;
    },
    getCurrentUpdatePriority: () => currentUpdatePriority,
    detachDeletedInstance: (instance: LayoutNode) => {
        instance.destroy();
    },
    resolveUpdatePriority() {
        if (currentUpdatePriority !== NoEventPriority) return currentUpdatePriority;
        return DefaultEventPriority;
    },
    trackSchedulerEvent: () => {},
    resolveEventType: () => null,
    resolveEventTimeStamp: () => -1.1,
    shouldAttemptEagerTransition: () => false,
    requestPostPaintCallback: () => {},
    maySuspendCommit: () => true,
    preloadInstance: () => true,
    startSuspendingCommit: () => {},
    suspendInstance: () => {},
    waitForCommitToBeReady: () => null,
    NotPendingTransition: undefined,
    HostTransitionContext: createContext(null) as any,
} as any;

export const RatatatReconciler: ReturnType<typeof ReactReconciler> = ReactReconciler(hostConfig);
