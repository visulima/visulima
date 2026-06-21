//! Criterion micro-benchmark for the oxc TS→JS transpiler (`src/transform.rs`).
//!
//! Closes the "transpile benchmark gap" noted in nubjs/nub#17. `transform_ts`
//! is the hot path behind `vis x`, config loading, and generator execution; the
//! hyperfine/vitest harness in `packages/tooling/vis/__bench__` can only see it
//! through the Node-boot floor. This measures the transpile itself.
//!
//! Run: `cargo bench -p vis-native --bench transform`
//!
//! Closing this transpile-benchmark gap is adapted from nub, under the following
//! license:
//!
//!   MIT License
//!
//!   Copyright (c) 2026 nub contributors
//!
//!   Source: https://github.com/nubjs/nub/pull/17

use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion, Throughput};
use vis_native::transform_ts;

/// A representative TS module: type annotations to strip, an enum + namespace to
/// lower (non-erasable), generics, and a class with parameter properties.
fn ts_source(repeat: usize) -> String {
    let unit = r#"
import type { Foo } from "./foo";

export enum Color { Red, Green, Blue }

export namespace Geometry {
    export interface Point { x: number; y: number }
    export const origin: Point = { x: 0, y: 0 };
}

export class Box<T> {
    constructor(private readonly value: T, public label: string) {}
    get(): T { return this.value; }
}

export function sum(values: readonly number[]): number {
    return values.reduce((acc: number, n: number): number => acc + n, 0);
}
"#;

    let mut out = String::with_capacity(unit.len() * repeat);
    for _ in 0..repeat {
        out.push_str(unit);
    }
    out
}

fn bench_transform_ts(c: &mut Criterion) {
    let mut group = c.benchmark_group("transform/transform_ts");
    // Small (single unit ≈ a config file) through large (a fat generator module).
    for repeat in [1usize, 20, 100] {
        let source = ts_source(repeat);
        group.throughput(Throughput::Bytes(source.len() as u64));
        group.bench_with_input(BenchmarkId::from_parameter(source.len()), &source, |b, s| {
            b.iter(|| black_box(transform_ts(black_box("module.ts".to_string()), black_box(s.clone())).unwrap()));
        });
    }
    group.finish();
}

criterion_group!(benches, bench_transform_ts);
criterion_main!(benches);
