// Bake the vis package version into the binary so `--version` is answered without
// reading any file at runtime. Crude JSON scan avoids a serde dependency.
use std::fs;

fn main() {
    println!("cargo:rerun-if-changed=../package.json");

    let version = fs::read_to_string("../package.json")
        .ok()
        .and_then(|text| {
            text.split("\"version\"")
                .nth(1)
                .and_then(|rest| rest.split('"').nth(1).map(str::to_owned))
        })
        .unwrap_or_else(|| "0.0.0".to_owned());

    println!("cargo:rustc-env=VIS_LAUNCHER_VERSION={version}");
}
