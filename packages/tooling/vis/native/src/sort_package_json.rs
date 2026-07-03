use napi_derive::napi;
use sort_package_json::{sort_package_json, sort_package_json_with_options, SortOptions};

#[napi(object)]
pub struct NativeSortPackageJsonOptions {
    /// Enable formatted output with newlines (default: true)
    pub pretty: Option<bool>,
    /// Alphabetize script commands (default: false)
    pub sort_scripts: Option<bool>,
}

#[napi(catch_unwind)]
pub fn sort_package_json_string(contents: String) -> napi::Result<String> {
    sort_package_json(&contents).map_err(|e| napi::Error::from_reason(e.to_string()))
}

#[napi(catch_unwind)]
pub fn sort_package_json_string_with_options(
    contents: String,
    options: NativeSortPackageJsonOptions,
) -> napi::Result<String> {
    let opts =
        SortOptions { pretty: options.pretty.unwrap_or(true), sort_scripts: options.sort_scripts.unwrap_or(false) };
    sort_package_json_with_options(&contents, &opts).map_err(|e| napi::Error::from_reason(e.to_string()))
}
