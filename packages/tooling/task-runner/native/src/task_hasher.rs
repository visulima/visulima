use napi_derive::napi;
use std::collections::BTreeMap;
use xxhash_rust::xxh3::xxh3_128;

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

/// Computes the command hash for a task using xxh3-128.
/// Takes project name, target name, optional configuration, and sorted overrides JSON.
#[napi(catch_unwind)]
pub fn hash_command(project: String, target: String, configuration: Option<String>, overrides_json: String) -> String {
    let mut data = Vec::new();
    data.extend_from_slice(project.as_bytes());
    data.extend_from_slice(target.as_bytes());

    if let Some(config) = &configuration {
        data.extend_from_slice(config.as_bytes());
    }

    data.extend_from_slice(overrides_json.as_bytes());

    let h = xxh3_128(&data);
    hex::encode(h.to_be_bytes())
}

/// Computes the final combined hash from task hash details using xxh3-128.
/// This produces the cache key used for lookup.
#[napi(catch_unwind)]
pub fn compute_task_hash(details: NativeTaskHashDetails) -> String {
    let mut data = Vec::new();

    // Hash the command
    data.extend_from_slice(details.command.as_bytes());

    // Sort and hash nodes for deterministic output
    let sorted_nodes: BTreeMap<&str, &str> =
        details.nodes.iter().filter(|pair| pair.len() == 2).map(|pair| (pair[0].as_str(), pair[1].as_str())).collect();

    for (key, value) in &sorted_nodes {
        data.extend_from_slice(key.as_bytes());
        data.push(0);
        data.extend_from_slice(value.as_bytes());
    }

    // Sort and hash implicit deps
    if let Some(implicit_deps) = &details.implicit_deps {
        let sorted: BTreeMap<&str, &str> = implicit_deps
            .iter()
            .filter(|pair| pair.len() == 2)
            .map(|pair| (pair[0].as_str(), pair[1].as_str()))
            .collect();

        for (key, value) in &sorted {
            data.extend_from_slice(key.as_bytes());
            data.push(0);
            data.extend_from_slice(value.as_bytes());
        }
    }

    // Sort and hash runtime
    if let Some(runtime) = &details.runtime {
        let sorted: BTreeMap<&str, &str> =
            runtime.iter().filter(|pair| pair.len() == 2).map(|pair| (pair[0].as_str(), pair[1].as_str())).collect();

        for (key, value) in &sorted {
            data.extend_from_slice(key.as_bytes());
            data.push(0);
            data.extend_from_slice(value.as_bytes());
        }
    }

    let h = xxh3_128(&data);
    hex::encode(h.to_be_bytes())
}

/// Hashes an environment variable name + value pair using xxh3-128.
#[napi(catch_unwind)]
pub fn hash_env_var(name: String, value: String) -> String {
    let mut data = Vec::new();
    data.extend_from_slice(name.as_bytes());
    data.push(0);
    data.extend_from_slice(value.as_bytes());

    let h = xxh3_128(&data);
    hex::encode(h.to_be_bytes())
}
