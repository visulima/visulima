use napi_derive::napi;

mod editorconfig;
mod pm_clean;
mod pm_detect;
mod pm_exec;
mod pm_resolve;
mod sort_package_json;

pub use editorconfig::*;
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
#[napi]
pub const NATIVE_BINDING_VERSION: u32 = 2;
