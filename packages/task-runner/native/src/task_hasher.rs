use napi::bindgen_prelude::*;
use napi_derive::napi;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

use crate::file_hasher::hex;

/// Represents the hash details for a task.
#[napi(object)]
pub struct NativeTaskHashDetails {
    /// The command hash.
    pub command: String,
    /// File/node hashes as key-value pairs [key, hash].
    pub nodes: Vec<Vec<String>>,
    /// Implicit dependency hashes as key-value pairs [key, hash].
    pub implicit_deps: Option<Vec<Vec<String>>>,
    /// Runtime hashes as key-value pairs [key, hash].
    pub runtime: Option<Vec<Vec<String>>>,
}

/// Computes the command hash for a task.
/// Takes project name, target name, optional configuration, and sorted overrides JSON.
#[napi]
pub fn hash_command(
    project: String,
    target: String,
    configuration: Option<String>,
    overrides_json: String,
) -> String {
    let mut hasher = Sha256::new();
    hasher.update(project.as_bytes());
    hasher.update(target.as_bytes());

    if let Some(config) = &configuration {
        hasher.update(config.as_bytes());
    }

    hasher.update(overrides_json.as_bytes());

    hex::encode(hasher.finalize())
}

/// Computes the final combined hash from task hash details.
/// This produces the cache key used for lookup.
#[napi]
pub fn compute_task_hash(details: NativeTaskHashDetails) -> String {
    let mut hasher = Sha256::new();

    // Hash the command
    hasher.update(details.command.as_bytes());

    // Sort and hash nodes for deterministic output
    let sorted_nodes: BTreeMap<&str, &str> = details
        .nodes
        .iter()
        .filter(|pair| pair.len() == 2)
        .map(|pair| (pair[0].as_str(), pair[1].as_str()))
        .collect();

    for (key, value) in &sorted_nodes {
        hasher.update(key.as_bytes());
        hasher.update(value.as_bytes());
    }

    // Sort and hash implicit deps
    if let Some(implicit_deps) = &details.implicit_deps {
        let sorted: BTreeMap<&str, &str> = implicit_deps
            .iter()
            .filter(|pair| pair.len() == 2)
            .map(|pair| (pair[0].as_str(), pair[1].as_str()))
            .collect();

        for (key, value) in &sorted {
            hasher.update(key.as_bytes());
            hasher.update(value.as_bytes());
        }
    }

    // Sort and hash runtime
    if let Some(runtime) = &details.runtime {
        let sorted: BTreeMap<&str, &str> = runtime
            .iter()
            .filter(|pair| pair.len() == 2)
            .map(|pair| (pair[0].as_str(), pair[1].as_str()))
            .collect();

        for (key, value) in &sorted {
            hasher.update(key.as_bytes());
            hasher.update(value.as_bytes());
        }
    }

    hex::encode(hasher.finalize())
}

/// Hashes an environment variable name + value pair.
#[napi]
pub fn hash_env_var(name: String, value: String) -> String {
    let mut hasher = Sha256::new();
    hasher.update(name.as_bytes());
    hasher.update(value.as_bytes());
    hex::encode(hasher.finalize())
}
