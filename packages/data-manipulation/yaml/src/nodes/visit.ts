/* eslint-disable no-plusplus */
/*
 * The walkers mutate the tree in place — that is the point of REMOVE and node
 * replacement — and they are mutually recursive, so declaration order cannot
 * satisfy no-use-before-define.
 */
/* eslint-disable no-param-reassign */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable unicorn/no-null */

/**
 * Generic traversal of a node tree.
 *
 * `visit` walks depth-first, calling the handler matching each node's kind. The
 * handler's return value steers the walk, which is what makes the whole tree
 * rewritable in one pass rather than by hand-rolled recursion per task.
 */

import type { Pair } from "./nodes";
import { isAlias, isMap, isPair, isScalar, isSeq } from "./nodes";

/** Control values a visitor may return. */
const BREAK: unique symbol = Symbol("break");

const SKIP: unique symbol = Symbol("skip");

const REMOVE: unique symbol = Symbol("remove");

/**
 * What a visitor returns:
 *
 * - `undefined` — carry on
 * - {@link SKIP} — do not descend into this node
 * - {@link BREAK} — stop the whole walk
 * - {@link REMOVE} — delete this node from its parent
 * - any node — replace this node in its parent, then descend into it
 *
 * The visitor is *not* re-invoked on a node it just returned (`yaml` does
 * re-invoke). Returning a node the visitor would itself replace therefore
 * terminates here instead of looping.
 */
type VisitorFunction = (key: number | string | null, node: unknown, path: ReadonlyArray<unknown>) => unknown;

/** Per-kind handlers; `Node` catches anything without a more specific entry. */
interface Visitor {
    Alias?: VisitorFunction;
    Map?: VisitorFunction;
    Node?: VisitorFunction;
    Pair?: VisitorFunction;
    Scalar?: VisitorFunction;
    Seq?: VisitorFunction;
}

const handlerFor = (node: unknown, visitor: Visitor): VisitorFunction | undefined => {
    if (isMap(node)) {
        return visitor.Map ?? visitor.Node;
    }

    if (isSeq(node)) {
        return visitor.Seq ?? visitor.Node;
    }

    if (isPair(node)) {
        return visitor.Pair;
    }

    if (isAlias(node)) {
        return visitor.Alias ?? visitor.Node;
    }

    if (isScalar(node)) {
        return visitor.Scalar ?? visitor.Node;
    }

    return undefined;
};

/**
 * Walk `node`, returning {@link BREAK} if the visitor stopped the traversal.
 *
 * Children are walked backwards so a visitor removing an item cannot shift the
 * indices of the ones still to be visited.
 */

const visitNode = (
    key: number | string | null,
    node: unknown,
    visitor: Visitor,
    path: unknown[],
    // Writes a replacement back into whichever slot of the parent `node`
    // occupies. Without it a visitor returning a node would rewrite only the
    // local variable and the tree would be left untouched.
    replace?: (value: unknown) => void,
): symbol | undefined => {
    const handler = handlerFor(node, visitor);

    let current = node;

    if (handler) {
        const result = handler(key, node, path);

        if (result === SKIP) {
            return undefined;
        }

        if (result === BREAK || result === REMOVE) {
            return result;
        }

        if (result !== undefined) {
            current = result;
            replace?.(result);
        }
    }

    path.push(current);

    const outcome = visitChildren(current, visitor, path);

    path.pop();

    return outcome;
};

/**
 * Walk a collection's items backwards, so a visitor removing one cannot shift
 * the indices of those still to be visited.
 */
const visitItems = (items: unknown[], visitor: Visitor, path: unknown[]): symbol | undefined => {
    for (let index = items.length - 1; index >= 0; index--) {
        const child = visitNode(index, items[index], visitor, path, (value) => {
            items[index] = value;
        });

        if (child === REMOVE) {
            items.splice(index, 1);
        } else if (child === BREAK) {
            return BREAK;
        }
    }

    return undefined;
};

/** Walk a pair's key, then its value. */
const visitPair = (pair: Pair, visitor: Visitor, path: unknown[]): symbol | undefined => {
    const keyOutcome = visitNode("key", pair.key, visitor, path, (value) => {
        pair.key = value;
    });

    if (keyOutcome === BREAK) {
        return BREAK;
    }

    if (keyOutcome === REMOVE) {
        pair.key = null;
    }

    const valueOutcome = visitNode("value", pair.value, visitor, path, (value) => {
        pair.value = value;
    });

    if (valueOutcome === BREAK) {
        return BREAK;
    }

    if (valueOutcome === REMOVE) {
        pair.value = null;
    }

    return undefined;
};

/** Dispatch into whichever children `node` has, if any. */
const visitChildren = (node: unknown, visitor: Visitor, path: unknown[]): symbol | undefined => {
    if (isMap(node) || isSeq(node)) {
        return visitItems(node.items, visitor, path);
    }

    if (isPair(node)) {
        return visitPair(node, visitor, path);
    }

    return undefined;
};

/** Walk a node tree, applying `visitor` to each node. */
const visit = (node: unknown, visitor: Visitor): void => {
    visitNode(null, node, visitor, []);
};

visit.BREAK = BREAK;
visit.SKIP = SKIP;
visit.REMOVE = REMOVE;

export type { Visitor, VisitorFunction };
export { BREAK, REMOVE, SKIP, visit };
