/**
 * Subpath entry: `@visulima/task-runner/graph`.
 *
 * Task-graph construction, traversal utilities, and graph visualization.
 * Importing this subpath avoids pulling in the cache, CAS, concurrent
 * runner, and remote-backend code.
 */

// Graph visualization (DOT / ASCII / HTML / JSON).
export type { GraphFormat, GraphJson, GraphVisualizerOptions } from "../graph-visualizer";
export { projectGraphToDot, toGraphAscii, toGraphHtml, toGraphJson, toGraphvizDot } from "../graph-visualizer";
export { createTaskGraph, getTaskId, parseTaskId } from "../task-graph";
export {
    findCycle,
    findCycles,
    getDependentTasks,
    getLeafTasks,
    getTransitiveDependencies,
    makeAcyclic,
    reverseTaskGraph,
    walkTaskGraph,
} from "../task-graph-utils";
export type {
    ProjectGraph,
    ProjectGraphDependency,
    ProjectGraphProjectNode,
    Task,
    TaskGraph,
    TaskTarget,
} from "../types";
