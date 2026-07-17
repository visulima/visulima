/**
 * Public DOM surface (`@visulima/tui/dom`).
 *
 * Types only, and deliberately so. `src/ink/dom.ts` also exports the tree
 * mutators the reconciler drives (`createNode`, `appendChildNode`,
 * `setAttribute`, …); those are renderer internals and must stay unexported —
 * a component calling them would corrupt the layout tree. Components only ever
 * need to *describe* a node they hold a ref to, which is what these types are for.
 */
export type { CursorAnchorRef, CursorMarker, DOMElement, DOMNode, DOMNodeAttribute, ElementNames, NodeNames, StickyHeader, TextName, TextNode } from "../dom";
