//! Shared pure logic for the vis native CLI front-end.
//!
//! Faithfully de-napi'd copies of the addon's package-manager detection
//! (`pm_detect.rs`) and command resolution (`pm_resolve.rs`). The logic is
//! identical to the shipped addon — only the napi wrappers/types are stripped —
//! so behaviour matches, and the per-function unit tests pin the argv output.

pub mod detect;
pub mod resolve;
