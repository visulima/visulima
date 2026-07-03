//! Criterion micro-benchmarks for the native task-graph operations.
//!
//! Counterpart to nubjs/nub#17's `workspace/build_dep_graph` +
//! `workspace/topological_chunks` criterion benches, pointed at OUR graph code
//! (`src/graph.rs`). These run the pure Rust functions directly, so they measure
//! the algorithm — not the Node-boot floor that the hyperfine/vitest harness in
//! `packages/tooling/vis/__bench__` is bound by.
//!
//! Run: `cargo bench -p task-runner-native --bench graph`
//!
//! The bench structure (synthetic DAG + topological-sort/cycle sweep) is adapted
//! from nub, under the following license:
//!
//!   MIT License
//!
//!   Copyright (c) 2026 nub contributors
//!
//!   Source: https://github.com/nubjs/nub/pull/17

use std::hint::black_box;

use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion};
use task_runner_native::{find_all_cycles, get_transitive_deps, topological_sort, NativeTaskGraph};

/// Builds a synthetic layered DAG: `layers` layers of `width` nodes each, every
/// node depending on every node in the previous layer. Acyclic by construction,
/// so `topological_sort` always succeeds. `200` total nodes is the size nub
/// benches at; we sweep a couple of sizes to expose super-linear behaviour.
fn layered_dag(layers: usize, width: usize) -> NativeTaskGraph {
    let mut task_ids = Vec::with_capacity(layers * width);
    for layer in 0..layers {
        for node in 0..width {
            task_ids.push(format!("t{layer}_{node}"));
        }
    }

    let mut edges = Vec::new();
    for layer in 1..layers {
        for node in 0..width {
            let to = format!("t{layer}_{node}");
            for previous in 0..width {
                let from = format!("t{}_{previous}", layer - 1);
                edges.push(vec![from, to.clone()]);
            }
        }
    }

    NativeTaskGraph { task_ids, edges }
}

fn bench_topological_sort(c: &mut Criterion) {
    let mut group = c.benchmark_group("graph/topological_sort");
    // 10×20 = 200 nodes / 3 800 edges — the nub-comparable point — plus a
    // larger one to catch a regression that 200 nodes would hide.
    for (layers, width) in [(10, 20), (20, 30)] {
        let graph = layered_dag(layers, width);
        let nodes = layers * width;
        group.bench_with_input(BenchmarkId::from_parameter(nodes), &graph, |b, g| {
            // Clone per iteration: topological_sort takes the graph by value.
            b.iter_batched(
                || clone_graph(g),
                |g| black_box(topological_sort(g).unwrap()),
                criterion::BatchSize::SmallInput,
            );
        });
    }
    group.finish();
}

fn bench_find_all_cycles(c: &mut Criterion) {
    let graph = layered_dag(10, 20);
    c.bench_function("graph/find_all_cycles/200", |b| {
        b.iter_batched(|| clone_graph(&graph), |g| black_box(find_all_cycles(g)), criterion::BatchSize::SmallInput);
    });
}

fn bench_transitive_deps(c: &mut Criterion) {
    let graph = layered_dag(10, 20);
    let root = graph.task_ids[0].clone();
    c.bench_function("graph/get_transitive_deps/200", |b| {
        b.iter_batched(
            || (clone_graph(&graph), root.clone()),
            |(g, id)| black_box(get_transitive_deps(g, id)),
            criterion::BatchSize::SmallInput,
        );
    });
}

/// `NativeTaskGraph` is a plain `#[napi(object)]` struct (no `Clone` derive), so
/// rebuild it by hand for each batched iteration.
fn clone_graph(g: &NativeTaskGraph) -> NativeTaskGraph {
    NativeTaskGraph { task_ids: g.task_ids.clone(), edges: g.edges.clone() }
}

criterion_group!(benches, bench_topological_sort, bench_find_all_cycles, bench_transitive_deps);
criterion_main!(benches);
