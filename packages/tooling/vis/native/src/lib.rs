use napi_derive::napi;

mod advisories;
mod advisories_napi;
mod editorconfig;
mod identify;
mod pm_clean;
mod pm_detect;
mod pm_exec;
mod pm_resolve;
mod sort_package_json;

pub use advisories_napi::*;
pub use editorconfig::*;
pub use identify::*;
pub use pm_clean::*;
pub use pm_detect::*;
pub use pm_exec::*;
pub use pm_resolve::*;
pub use sort_package_json::*;

/// ABI compatibility version. Bump this whenever any `#[napi]` function
/// signature changes so the TypeScript loader can reject stale `.node`
/// files (e.g. a local build from before the change) that would
/// otherwise silently misinterpret arguments.
///
/// Version history:
///   1 — initial versioned ABI. `resolve_link` gained a `version` parameter.
///   2 — added `resolve_editorconfig_defaults` (replaces the `editorconfig` npm package).
///   3 — added prek-identify bindings: `tags_from_path`, `tags_from_paths`,
///       `parse_shebang`, `all_known_tags`.
///   4 — added offline advisories: `advisories_ingest`, `advisories_query`,
///       `advisories_status`. Backed by bundled SQLite (rusqlite) + zip.
#[napi]
pub const NATIVE_BINDING_VERSION: u32 = 4;
