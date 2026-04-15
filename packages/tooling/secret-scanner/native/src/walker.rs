// Directory walker built on the `ignore` crate.

use std::path::PathBuf;
use std::sync::Mutex;

use ignore::{WalkBuilder, WalkState};

#[derive(Debug, Clone)]
pub struct WalkOptions {
    pub respect_gitignore: bool,
    pub respect_hidden: bool,
    pub extra_ignores: Vec<String>,
    pub threads: usize,
}

impl Default for WalkOptions {
    fn default() -> Self {
        Self { respect_gitignore: true, respect_hidden: true, extra_ignores: Vec::new(), threads: 0 }
    }
}

/// Synchronously walk `roots` and return every file path discovered, respecting
/// ignore rules. `build_parallel` handles concurrency internally, so no extra
/// orchestration thread is spawned — a panic inside the walker propagates to
/// the caller instead of deadlocking the channel.
pub fn walk_paths(roots: &[PathBuf], opts: &WalkOptions) -> Vec<PathBuf> {
    if roots.is_empty() {
        return Vec::new();
    }

    let mut builder = WalkBuilder::new(&roots[0]);
    for r in roots.iter().skip(1) {
        builder.add(r);
    }

    // `ignore` crate treats threads(0) as "auto", so pass through unchanged.
    builder
        .standard_filters(opts.respect_gitignore)
        .git_ignore(opts.respect_gitignore)
        .git_exclude(opts.respect_gitignore)
        .git_global(opts.respect_gitignore)
        .hidden(opts.respect_hidden)
        .follow_links(false)
        .threads(opts.threads);

    if !opts.extra_ignores.is_empty() {
        let mut ob = ignore::overrides::OverrideBuilder::new(&roots[0]);
        for pat in &opts.extra_ignores {
            // `!` prefix makes it an exclusion pattern in the `ignore` override syntax.
            if let Err(e) = ob.add(&format!("!{pat}")) {
                eprintln!("secret-scanner: ignoring invalid extraIgnores pattern {pat:?}: {e}");
            }
        }
        match ob.build() {
            Ok(over) => {
                builder.overrides(over);
            }
            Err(e) => {
                eprintln!("secret-scanner: failed to build extraIgnores overrides: {e}");
            }
        }
    }

    let collected = Mutex::new(Vec::<PathBuf>::new());
    builder.build_parallel().run(|| {
        let collected = &collected;
        Box::new(move |result| {
            if let Ok(entry) = result {
                if entry.file_type().map(|t| t.is_file()).unwrap_or(false) {
                    if let Ok(mut v) = collected.lock() {
                        v.push(entry.into_path());
                    }
                }
            }
            WalkState::Continue
        })
    });

    collected.into_inner().unwrap_or_default()
}
