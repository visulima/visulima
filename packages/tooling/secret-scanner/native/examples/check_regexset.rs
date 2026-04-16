use std::fs;
use serde_json::Value;

fn main() {
    let raw = fs::read_to_string("data/gitleaks.json").unwrap();
    let v: Value = serde_json::from_str(&raw).unwrap();
    let rules = v["rules"].as_array().unwrap();
    let patterns: Vec<String> = rules.iter().filter_map(|r| r["regex"].as_str().map(String::from)).collect();
    println!("patterns: {}", patterns.len());

    // Try per-rule Fast compile
    let mut fast_ok = 0;
    let mut fast_err = 0;
    for p in &patterns {
        match regex::bytes::RegexBuilder::new(p).size_limit(10 << 20).build() {
            Ok(_) => fast_ok += 1,
            Err(_e) => fast_err += 1,
        }
    }
    println!("Fast: ok={} err={}", fast_ok, fast_err);

    // Try RegexSet build
    match regex::bytes::RegexSetBuilder::new(&patterns).size_limit(10 << 20).dfa_size_limit(32 << 20).build() {
        Ok(set) => println!("RegexSet OK, patterns: {}", set.len()),
        Err(e) => println!("RegexSet ERR: {}", e),
    }
}
