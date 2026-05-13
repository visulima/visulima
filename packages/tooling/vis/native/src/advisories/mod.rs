//! Offline OSV advisory database.
//!
//! Schema, ingest, query, and per-ecosystem range matching for a single
//! `<cache>/vis/advisories/db.sqlite` shared across every synced ecosystem.

pub mod ingest;
pub mod osv;
pub mod query;
pub mod range;
pub mod schema;
pub mod status;

pub use ingest::ingest;
pub use query::{AdvisoryHit, QueryInput, query};
pub use schema::NATIVE_KNOWN_VERSION;
pub use status::{DbStatus, EcosystemStatus, status};
