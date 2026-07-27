import type { TreeNode } from "./types";

/**
 * A flattened representation of a tree node with navigation links.
 */
export type FlatNode<T = Record<string, unknown>> = {
    /** Ordered list of direct children IDs. */
    readonly childrenIds: ReadonlyArray<string>;
    /** Depth in the tree (0 for roots). */
    readonly depth: number;
    /** Index in the flattened DFS order (across ALL nodes, not just visible). */
    readonly flatIndex: number;
    /** Whether this node has children. */
    readonly hasChildren: boolean;
    /** Next sibling's ID, or undefined. */
    readonly nextSiblingId: string | undefined;
    /** The original tree node. */
    readonly node: TreeNode<T>;
    /** Parent's id, or undefined if root. */
    readonly parentId: string | undefined;
    /** Previous sibling's ID, or undefined. */
    readonly previousSiblingId: string | undefined;
    /** Total number of siblings (including this node). */
    readonly siblingCount: number;
    /** Zero-based index among siblings. */
    readonly siblingIndex: number;
};

type StackEntry<T> = {
    readonly depth: number;
    readonly node: TreeNode<T>;
    readonly parentId: string | undefined;
    readonly siblingIndex: number;
    readonly siblings: TreeNode<T>[];
};

/**
 * A flattened map of all tree nodes built via DFS traversal.
 * Stores parent/child/sibling links for O(1) navigation.
 */
export class TreeNodeMap<T = Record<string, unknown>> {
    /** All node IDs in DFS order. */
    readonly orderedIds: string[];

    /** Root-level node IDs. */
    readonly rootIds: string[];

    /** Map from node ID to FlatNode. */
    private readonly map: Map<string, FlatNode<T>>;

    constructor(data: TreeNode<T>[]) {
        this.map = new Map();
        this.orderedIds = [];
        this.rootIds = [];

        this.buildFromData(data);
    }

    /**
     * Iterate over all entries.
     */
    entries(): IterableIterator<[string, FlatNode<T>]> {
        return this.map.entries();
    }

    /**
     * Get a flat node by ID.
     */
    get(id: string): FlatNode<T> | undefined {
        return this.map.get(id);
    }

    /**
     * Total number of nodes in the tree.
     */
    get size(): number {
        return this.map.size;
    }

    /**
     * Given a set of expanded node IDs, return the ordered list of
     * VISIBLE node IDs (i.e., a node is visible if all its ancestors
     * are expanded).
     *
     * Uses iterative DFS, skipping collapsed subtrees.
     */
    getVisibleIds(expandedIds: ReadonlySet<string>): string[] {
        const result: string[] = [];
        const stack: string[] = [];

        // Push root IDs in reverse so first root is processed first
        for (let index = this.rootIds.length - 1; index >= 0; index--) {
            stack.push(this.rootIds[index]!);
        }

        while (stack.length > 0) {
            const id = stack.pop()!;

            result.push(id);

            const flatNode = this.map.get(id);

            if (flatNode && expandedIds.has(id) && flatNode.childrenIds.length > 0) {
                // Push children in reverse so first child is processed first
                for (let index = flatNode.childrenIds.length - 1; index >= 0; index--) {
                    stack.push(flatNode.childrenIds[index]!);
                }
            }
        }

        return result;
    }

    /**
     * Check if a node is a descendant of another node.
     */
    isDescendantOf(nodeId: string, ancestorId: string): boolean {
        let currentId: string | undefined = nodeId;

        while (currentId !== undefined) {
            const flat = this.map.get(currentId);

            if (!flat) {
                return false;
            }

            if (flat.parentId === ancestorId) {
                return true;
            }

            currentId = flat.parentId;
        }

        return false;
    }

    /**
     * Insert dynamically-loaded children under a parent node.
     * Returns a new TreeNodeMap (immutable operation).
     *
     * Rebuilds the full tree from the current map state (not the original
     * input data), so successive calls for different parents are safe.
     */
    withChildren(parentId: string, children: TreeNode<T>[]): TreeNodeMap<T> {
        const parentFlat = this.map.get(parentId);

        if (!parentFlat) {
            return this;
        }

        // Rebuild tree from current map state so previous withChildren
        // mutations are preserved (the original node.children may be stale).
        const rebuildFromMap = (id: string): TreeNode<T> => {
            const flat = this.map.get(id)!;

            if (id === parentId) {
                return { ...flat.node, children };
            }

            if (flat.childrenIds.length > 0) {
                return { ...flat.node, children: flat.childrenIds.map((childId) => rebuildFromMap(childId)) };
            }

            return flat.node;
        };

        const rootData = this.rootIds.map((nodeId) => rebuildFromMap(nodeId));

        return new TreeNodeMap(rootData);
    }

    private buildFromData(data: TreeNode<T>[]): void {
        const stack: StackEntry<T>[] = [];

        // Push root nodes in reverse order so first root is processed first
        for (let index = data.length - 1; index >= 0; index--) {
            stack.push({
                depth: 0,
                node: data[index]!,
                parentId: undefined,
                siblingIndex: index,
                siblings: data,
            });
        }

        // Collect root IDs
        for (const node of data) {
            this.rootIds.push(node.id);
        }

        let flatIndex = 0;

        while (stack.length > 0) {
            const entry = stack.pop()!;
            const { depth, node, parentId, siblingIndex, siblings } = entry;

            // Check for duplicate IDs
            if (this.map.has(node.id)) {
                throw new Error(`TreeView: Duplicate node id '${node.id}' found. All node ids must be unique.`);
            }

            const children = node.children ?? [];
            const hasChildren = children.length > 0 || node.isParent === true;
            const childrenIds = children.map((c) => c.id);

            const previousSiblingId = siblingIndex > 0 ? siblings[siblingIndex - 1]!.id : undefined;
            const nextSiblingId = siblingIndex < siblings.length - 1 ? siblings[siblingIndex + 1]!.id : undefined;

            const flatNode: FlatNode<T> = {
                childrenIds,
                depth,
                flatIndex,
                hasChildren,
                nextSiblingId,
                node,
                parentId,
                previousSiblingId,
                siblingCount: siblings.length,
                siblingIndex,
            };

            this.map.set(node.id, flatNode);
            this.orderedIds.push(node.id);
            flatIndex++;

            // Push children in reverse order for correct DFS ordering
            if (hasChildren) {
                for (let index = children.length - 1; index >= 0; index--) {
                    stack.push({
                        depth: depth + 1,
                        node: children[index]!,
                        parentId: node.id,
                        siblingIndex: index,
                        siblings: children,
                    });
                }
            }
        }
    }
}
