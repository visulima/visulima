use napi::bindgen_prelude::*;
use napi_derive::napi;
use std::collections::VecDeque;

// Graph IDs are short, trusted, in-process strings (task names), not
// attacker-controlled network input — the DoS resistance of SipHash buys us
// nothing here and costs throughput on the hot adjacency/in-degree maps. Swap
// in rustc-hash's Fx hasher (the rustc/turbo/swc default) for these. Aliased to
// the std names so the call sites below read unchanged; only `::new()` becomes
// `::default()` (a custom-hasher map has no `::new`).
//
// The FxHashMap/FxHashSet swap is adapted from nub (`workspace/filter.rs` +
// `pm/registry.rs`), under the following license:
//
//   MIT License
//
//   Copyright (c) 2026 nub contributors
//
//   Source: https://github.com/nubjs/nub/pull/17
use rustc_hash::{FxHashMap as HashMap, FxHashSet as HashSet};

/// Represents a task graph for native graph operations.
#[napi(object)]
pub struct NativeTaskGraph {
    /// All task IDs in the graph.
    pub task_ids: Vec<String>,
    /// Dependencies as pairs of [from_task_id, to_task_id].
    pub edges: Vec<Vec<String>>,
}

/// Result of cycle detection.
#[napi(object, object_from_js = false)]
pub struct CycleResult {
    /// Whether a cycle was found.
    pub has_cycle: bool,
    /// The cycle as a list of task IDs, or empty if no cycle.
    pub cycle: Vec<String>,
}

/// Finds a single cycle in the task graph using DFS.
#[napi(catch_unwind)]
pub fn find_cycle(graph: NativeTaskGraph) -> CycleResult {
    let adjacency = build_adjacency(&graph);
    let mut visited = HashSet::default();
    let mut in_stack = HashSet::default();
    let mut parent: HashMap<String, String> = HashMap::default();

    for task_id in &graph.task_ids {
        if visited.contains(task_id.as_str()) {
            continue;
        }

        let mut stack = vec![task_id.clone()];

        while let Some(current) = stack.last().cloned() {
            if !visited.contains(current.as_str()) {
                visited.insert(current.clone());
                in_stack.insert(current.clone());
            }

            let deps = adjacency.get(current.as_str()).cloned().unwrap_or_default();
            let mut found_unvisited = false;

            for dep in &deps {
                if in_stack.contains(dep.as_str()) {
                    // Found cycle - reconstruct
                    let mut cycle = vec![dep.clone()];
                    let mut node = current.clone();
                    while node != *dep {
                        cycle.push(node.clone());
                        node = parent.get(&node).cloned().unwrap_or_else(|| dep.clone());
                    }
                    cycle.push(dep.clone());
                    cycle.reverse();

                    return CycleResult { has_cycle: true, cycle };
                }

                if !visited.contains(dep.as_str()) {
                    parent.insert(dep.clone(), current.clone());
                    stack.push(dep.clone());
                    found_unvisited = true;
                    break;
                }
            }

            if !found_unvisited {
                stack.pop();
                in_stack.remove(current.as_str());
            }
        }
    }

    CycleResult { has_cycle: false, cycle: Vec::new() }
}

/// Finds all cycles in the task graph.
///
/// Iterative DFS — a recursive implementation would blow the native
/// thread's stack on a deep task chain (NAPI threads run with a smaller
/// stack than the main thread on some platforms). Each work-stack
/// frame holds `(node, next_child_index)` so we can resume scanning
/// children after recursing into a child.
#[napi(catch_unwind)]
pub fn find_all_cycles(graph: NativeTaskGraph) -> Vec<Vec<String>> {
    let adjacency = build_adjacency(&graph);
    let mut cycles: Vec<Vec<String>> = Vec::new();
    let mut visited: HashSet<String> = HashSet::default();
    let mut in_stack: HashSet<String> = HashSet::default();
    let mut path: Vec<String> = Vec::new();
    let mut work: Vec<(String, usize)> = Vec::new();

    let empty: Vec<String> = Vec::new();

    for task_id in &graph.task_ids {
        if visited.contains(task_id.as_str()) {
            continue;
        }

        visited.insert(task_id.clone());
        in_stack.insert(task_id.clone());
        path.push(task_id.clone());
        work.push((task_id.clone(), 0));

        while let Some((node, idx)) = work.last().cloned() {
            let deps = adjacency.get(&node).unwrap_or(&empty);

            if idx >= deps.len() {
                work.pop();
                path.pop();
                in_stack.remove(&node);
                continue;
            }

            let dep = deps[idx].clone();
            let last_idx = work.len() - 1;
            work[last_idx].1 = idx + 1;

            if in_stack.contains(dep.as_str()) {
                if let Some(cycle_start) = path.iter().position(|s| s == &dep) {
                    let mut cycle: Vec<String> = path[cycle_start..].to_vec();
                    cycle.push(dep.clone());
                    cycles.push(cycle);
                }
            } else if !visited.contains(dep.as_str()) {
                visited.insert(dep.clone());
                in_stack.insert(dep.clone());
                path.push(dep.clone());
                work.push((dep, 0));
            }
        }
    }

    cycles
}

/// Performs a topological sort of the task graph.
/// Returns task IDs in topological order (dependencies first).
#[napi(catch_unwind)]
pub fn topological_sort(graph: NativeTaskGraph) -> Result<Vec<String>> {
    let adjacency = build_adjacency(&graph);
    let mut in_degree: HashMap<String, usize> = HashMap::default();

    for task_id in &graph.task_ids {
        in_degree.entry(task_id.clone()).or_insert(0);
    }

    for deps in adjacency.values() {
        for dep in deps {
            *in_degree.entry(dep.clone()).or_insert(0) += 1;
        }
    }

    let mut queue: VecDeque<String> = VecDeque::new();
    for (task_id, &degree) in &in_degree {
        if degree == 0 {
            queue.push_back(task_id.clone());
        }
    }

    let mut result: Vec<String> = Vec::new();

    while let Some(task_id) = queue.pop_front() {
        result.push(task_id.clone());

        if let Some(deps) = adjacency.get(&task_id) {
            for dep in deps {
                if let Some(degree) = in_degree.get_mut(dep) {
                    *degree -= 1;
                    if *degree == 0 {
                        queue.push_back(dep.clone());
                    }
                }
            }
        }
    }

    if result.len() != graph.task_ids.len() {
        return Err(Error::new(Status::GenericFailure, "Graph contains cycles - topological sort is not possible"));
    }

    Ok(result)
}

/// Makes the graph acyclic by removing back edges.
/// Returns the edges that were removed.
///
/// Iterative DFS for the same reason as `find_all_cycles`.
#[napi(catch_unwind)]
pub fn find_back_edges(graph: NativeTaskGraph) -> Vec<Vec<String>> {
    let adjacency = build_adjacency(&graph);
    let mut visited: HashSet<String> = HashSet::default();
    let mut in_stack: HashSet<String> = HashSet::default();
    let mut back_edges: Vec<Vec<String>> = Vec::new();
    let mut work: Vec<(String, usize)> = Vec::new();

    let empty: Vec<String> = Vec::new();

    for task_id in &graph.task_ids {
        if visited.contains(task_id.as_str()) {
            continue;
        }

        visited.insert(task_id.clone());
        in_stack.insert(task_id.clone());
        work.push((task_id.clone(), 0));

        while let Some((node, idx)) = work.last().cloned() {
            let deps = adjacency.get(&node).unwrap_or(&empty);

            if idx >= deps.len() {
                work.pop();
                in_stack.remove(&node);
                continue;
            }

            let dep = deps[idx].clone();
            let last_idx = work.len() - 1;
            work[last_idx].1 = idx + 1;

            if in_stack.contains(dep.as_str()) {
                back_edges.push(vec![node.clone(), dep.clone()]);
            } else if !visited.contains(dep.as_str()) {
                visited.insert(dep.clone());
                in_stack.insert(dep.clone());
                work.push((dep, 0));
            }
        }
    }

    back_edges
}

/// Gets all transitive dependencies of a task.
#[napi(catch_unwind)]
pub fn get_transitive_deps(graph: NativeTaskGraph, task_id: String) -> Vec<String> {
    let adjacency = build_adjacency(&graph);
    let mut result: Vec<String> = Vec::new();
    let mut visited = HashSet::default();
    let mut queue = VecDeque::new();
    queue.push_back(task_id.clone());

    while let Some(current) = queue.pop_front() {
        if visited.contains(&current) {
            continue;
        }
        visited.insert(current.clone());

        if current != task_id {
            result.push(current.clone());
        }

        if let Some(deps) = adjacency.get(&current) {
            for dep in deps {
                if !visited.contains(dep) {
                    queue.push_back(dep.clone());
                }
            }
        }
    }

    result
}

/// Gets all tasks that depend on the given task (reverse transitive dependencies).
#[napi(catch_unwind)]
pub fn get_dependent_tasks(graph: NativeTaskGraph, task_id: String) -> Vec<String> {
    // Build reverse adjacency
    let mut reverse_adj: HashMap<String, Vec<String>> = HashMap::default();
    for id in &graph.task_ids {
        reverse_adj.entry(id.clone()).or_default();
    }
    for edge in &graph.edges {
        if edge.len() == 2 {
            reverse_adj.entry(edge[1].clone()).or_default().push(edge[0].clone());
        }
    }

    let mut result: Vec<String> = Vec::new();
    let mut visited = HashSet::default();
    let mut queue = VecDeque::new();
    queue.push_back(task_id.clone());

    while let Some(current) = queue.pop_front() {
        if visited.contains(&current) {
            continue;
        }
        visited.insert(current.clone());

        if current != task_id {
            result.push(current.clone());
        }

        if let Some(deps) = reverse_adj.get(&current) {
            for dep in deps {
                if !visited.contains(dep) {
                    queue.push_back(dep.clone());
                }
            }
        }
    }

    result
}

/// Builds an adjacency list from the graph edges.
fn build_adjacency(graph: &NativeTaskGraph) -> HashMap<String, Vec<String>> {
    let mut adjacency: HashMap<String, Vec<String>> = HashMap::default();

    for task_id in &graph.task_ids {
        adjacency.entry(task_id.clone()).or_default();
    }

    for edge in &graph.edges {
        if edge.len() == 2 {
            adjacency.entry(edge[0].clone()).or_default().push(edge[1].clone());
        }
    }

    adjacency
}
