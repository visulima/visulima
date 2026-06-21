//! Criterion micro-benchmark for the cache content hasher (`src/file_hasher.rs`).
//!
//! Counterpart to nubjs/nub#17's `cache-hash` criterion bench. nub switched
//! SHA-256 → blake3; we already hash with xxh3-128 (non-cryptographic, faster
//! than blake3 for cache content). This pins the throughput so a future change
//! to the hasher is a measured decision, not a guess.
//!
//! Run: `cargo bench -p task-runner-native --bench file_hasher`
//!
//! The bench structure (content-hash throughput sweep) is adapted from nub's
//! `cache-hash` criterion bench, under the following license:
//!
//!   MIT License
//!
//!   Copyright (c) 2026 nub contributors
//!
//!   Source: https://github.com/nubjs/nub/pull/17

use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion, Throughput};
use task_runner_native::hash_bytes;

fn bench_hash_bytes(c: &mut Criterion) {
    let mut group = c.benchmark_group("file_hasher/hash_bytes");
    // Representative source-file sizes: a small module, a typical file, and a
    // large generated/bundled artifact.
    for size in [4 * 1024usize, 64 * 1024, 1024 * 1024] {
        // Deterministic, non-uniform bytes so the hasher can't shortcut.
        let data: Vec<u8> = (0..size).map(|i| (i.wrapping_mul(2654435761) >> 13) as u8).collect();
        group.throughput(Throughput::Bytes(size as u64));
        group.bench_with_input(BenchmarkId::from_parameter(size), &data, |b, d| {
            b.iter(|| black_box(hash_bytes(black_box(d))));
        });
    }
    group.finish();
}

criterion_group!(benches, bench_hash_bytes);
criterion_main!(benches);
