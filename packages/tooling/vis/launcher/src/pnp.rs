//! Yarn Plug'n'Play detection. Only active when a `.pnp.cjs` is present — that
//! file is generated solely by Yarn in PnP mode, so its presence *is* the "yarn
//! PnP is in use" signal. In a PnP tree there is no `node_modules`; resolution
//! goes through the `.pnp.cjs` runtime, so a directly-spawned Node must load it
//! (`--require <.pnp.cjs>`, plus the ESM loader for `import` resolution) BEFORE our
//! own preload, so the script's bare imports resolve. Mirrors nub's `pnp` module.

use std::path::{Path, PathBuf};

/// A detected Yarn PnP context.
pub struct PnpContext {
    /// The `.pnp.cjs` runtime to `--require`.
    pub pnp_cjs: PathBuf,
    /// The sibling `.pnp.loader.mjs` ESM loader, if Yarn generated one (needed for
    /// `import` of bare specifiers under PnP).
    pub esm_loader: Option<PathBuf>,
}

/// Walk up from `cwd` to the nearest `.pnp.cjs`. `None` when not a PnP tree.
pub fn detect(cwd: &Path) -> Option<PnpContext> {
    let mut dir = cwd;

    loop {
        let candidate = dir.join(".pnp.cjs");

        if candidate.is_file() {
            let loader = dir.join(".pnp.loader.mjs");

            return Some(PnpContext {
                pnp_cjs: candidate,
                esm_loader: loader.is_file().then_some(loader),
            });
        }

        match dir.parent() {
            Some(parent) if parent != dir => dir = parent,
            _ => return None,
        }
    }
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::detect;

    #[test]
    fn detects_pnp_at_ancestor_with_optional_loader() {
        let root = env_temp().join(format!("vis-pnp-{}", std::process::id()));
        let nested = root.join("a").join("b");

        fs::create_dir_all(&nested).unwrap();

        // No .pnp.cjs → None (the system temp dir is not a PnP tree).
        assert!(detect(&nested).is_none());

        // .pnp.cjs at an ancestor → found; loader picked up when present.
        fs::write(root.join(".pnp.cjs"), "// pnp").unwrap();
        let found = detect(&nested).expect("ancestor .pnp.cjs");
        assert_eq!(found.pnp_cjs, root.join(".pnp.cjs"));
        assert!(found.esm_loader.is_none());

        fs::write(root.join(".pnp.loader.mjs"), "// loader").unwrap();
        assert_eq!(detect(&nested).unwrap().esm_loader, Some(root.join(".pnp.loader.mjs")));

        fs::remove_dir_all(&root).ok();
    }

    fn env_temp() -> std::path::PathBuf {
        std::env::temp_dir()
    }
}
