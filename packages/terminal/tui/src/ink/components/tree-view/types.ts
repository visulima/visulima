/**
 * A single node in the tree. Generic over the user's data shape.
 * The `id` field MUST be unique across the entire tree.
 */
export type TreeNode<T = Record<string, unknown>> = {
    /** Child nodes. Undefined or empty array means leaf node. */
    readonly children?: TreeNode<T>[];
    /** Arbitrary user data attached to this node. */
    readonly data?: T;
    /** Unique identifier for this node. Used as the key for all lookups. */
    readonly id: string;

    /**
     * Explicitly marks this node as a parent that can have children loaded
     * asynchronously via `loadChildren`. When true, the node shows an expand
     * indicator even if `children` is empty or undefined, and expanding it
     * triggers the `loadChildren` callback.
     */
    readonly isParent?: boolean;
    /** Display label. Used by the default renderer. */
    readonly label: string;
};

/**
 * For async/lazy loading: a function that resolves children on demand.
 */
export type AsyncChildrenFunction<T = Record<string, unknown>> = (node: TreeNode<T>) => Promise<TreeNode<T>[]>;

/**
 * State passed to custom renderers and theme functions.
 */
export type TreeNodeState = {
    /** Depth of this node in the tree (root = 0). */
    readonly depth: number;
    /** Whether this node has children (or a lazy loader). */
    readonly hasChildren: boolean;
    /** Whether this node is expanded (children visible). */
    readonly isExpanded: boolean;
    /** Whether this node is currently focused (cursor is on it). */
    readonly isFocused: boolean;
    /** Whether children are currently loading (async mode). */
    readonly isLoading: boolean;
    /** Whether this node is selected (in select/multi-select mode). */
    readonly isSelected: boolean;
};

/**
 * Props received by a custom node renderer.
 */
export type TreeNodeRendererProps<T = Record<string, unknown>> = {
    /** The tree node data. */
    readonly node: TreeNode<T>;
    /** Current state of this node. */
    readonly state: TreeNodeState;
};

/**
 * Selection mode for the tree view.
 */
export type SelectionMode = "multiple" | "none" | "single";
