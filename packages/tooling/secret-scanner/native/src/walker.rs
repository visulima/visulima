// Directory walker built on the `ignore` crate.

use std::path::PathBuf;
use std::sync::Mutex;

use ignore::gitignore::GitignoreBuilder;
use ignore::{WalkBuilder, WalkState};

#[derive(Debug, Clone, Default)]
pub struct WalkOptions {
    pub respect_gitignore: bool,
    pub respect_hidden: bool,
    /// Raw gitignore-syntax lines (e.g. `dist/`, `!keep-me.env`). Applied on top of
    /// `.gitignore`, supports negation and directory markers.
    pub extra_ignores: Vec<String>,
    /// Paths to additional files whose content is gitignore-syntax. Loaded alongside
    /// any `.gitignore` / `.git/info/exclude` the walker already picks up.
    pub ignore_files: Vec<PathBuf>,
    pub threads: usize,
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

    // Additional ignore files — treated exactly like `.gitignore` (negation, `/` prefix,
    // directory markers, etc. all behave as git would).
    for path in &opts.ignore_files {
        if let Some(e) = builder.add_ignore(path) {
            eprintln!("secret-scanner: ignoring invalid ignore file {}: {e}", path.display());
        }
    }

    // Inline gitignore-syntax patterns. Compile once and attach via `add_custom_ignore_filename`
    // isn't an option (that takes a filename, not patterns), so we build a Gitignore matcher
    // and use it as a filter inside the parallel walker below.
    let custom_gitignore = if opts.extra_ignores.is_empty() {
        None
    } else {
        let mut b = GitignoreBuilder::new(&roots[0]);
        for pat in &opts.extra_ignores {
            if let Err(e) = b.add_line(None, pat) {
                eprintln!("secret-scanner: ignoring invalid extraIgnores pattern {pat:?}: {e}");
            }
        }
        match b.build() {
            Ok(gi) => Some(gi),
            Err(e) => {
                eprintln!("secret-scanner: failed to build extraIgnores matcher: {e}");
                None
            }
        }
    };

    let collected = Mutex::new(Vec::<PathBuf>::new());
    let custom = custom_gitignore.as_ref();

    builder.build_parallel().run(|| {
        let collected = &collected;
        Box::new(move |result| {
            if let Ok(entry) = result {
                let is_file = entry.file_type().map(|t| t.is_file()).unwrap_or(false);
                if !is_file {
                    return WalkState::Continue;
                }

                let path = entry.path();
                if let Some(gi) = custom {
                    if gi.matched(path, false).is_ignore() {
                        return WalkState::Continue;
                    }
                }

                if let Ok(mut v) = collected.lock() {
                    v.push(entry.into_path());
                }
            }
            WalkState::Continue
        })
    });

    collected.into_inner().unwrap_or_default()
}
