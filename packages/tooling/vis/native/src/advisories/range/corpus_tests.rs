//! OSV corpus parity tests. Each ecosystem matcher already has per-dialect
//! unit tests covering edge cases of the version grammar; this module exists
//! to prove that real OSV advisory documents — exactly as they appear on
//! osv.dev — round-trip through `osv::Advisory` deserialization, `to_pairs()`,
//! and the dispatched matcher for an end-to-end classification that matches
//! what OSV's own scanner would conclude.
//!
//! Each test embeds a real published advisory's JSON shape (id, affected
//! ranges, fixed versions trimmed for size) and asserts that:
//!   1. The advisory deserializes cleanly.
//!   2. `matcher_for(ecosystem)` returns a matcher (i.e., dispatch covers it).
//!   3. A version inside the advertised range is reported affected.
//!   4. The advertised fixed version (or one above it) is reported clean.
//!
//! If OSV later restructures a record, the JSON literal here will become a
//! stale snapshot — the test name documents the upstream advisory id so a
//! refresh is a one-line grep away.

use super::matcher_for;
use crate::advisories::osv::Advisory;

fn parse(json: &str) -> Advisory {
    serde_json::from_str(json).expect("real OSV record must deserialize")
}

fn assert_dispatch(advisory: &Advisory, affected_idx: usize, version: &str, expected_affected: bool) {
    let affected = &advisory.affected[affected_idx];
    let matcher = matcher_for(&affected.package.ecosystem)
        .unwrap_or_else(|| panic!("no matcher registered for ecosystem {}", affected.package.ecosystem));

    let mut any_match = false;
    for range in &affected.ranges {
        for pair in range.to_pairs() {
            if matcher.matches(version, &pair.introduced, pair.fixed.as_deref()) {
                any_match = true;
                break;
            }
        }
        if any_match {
            break;
        }
    }

    assert_eq!(
        any_match, expected_affected,
        "ecosystem {} version {} classification mismatch (advisory {})",
        affected.package.ecosystem, version, advisory.id,
    );
}

//
// Real shape from GHSA-jf85-cpcp-j695 (lodash prototype pollution, fixed in
// 4.17.12). Picked because it's the canonical npm OSV exemplar.
#[test]
fn corpus_npm_lodash_prototype_pollution() {
    let json = r#"{
        "id": "GHSA-jf85-cpcp-j695",
        "summary": "Prototype Pollution in lodash",
        "aliases": ["CVE-2019-10744"],
        "affected": [{
            "package": { "ecosystem": "npm", "name": "lodash" },
            "ranges": [{
                "type": "SEMVER",
                "events": [
                    { "introduced": "0" },
                    { "fixed": "4.17.12" }
                ]
            }]
        }]
    }"#;
    let adv = parse(json);

    assert_dispatch(&adv, 0, "4.17.11", true);
    assert_dispatch(&adv, 0, "3.0.0", true);
    assert_dispatch(&adv, 0, "4.17.12", false);
    assert_dispatch(&adv, 0, "4.17.21", false);
}

//
// Real shape from GHSA-h4qu-5jpq-4mf5 (urllib3 CRLF injection, fixed in
// 1.25.9). pep440 ranges use `ECOSYSTEM` event type, not `SEMVER`.
#[test]
fn corpus_pypi_urllib3_crlf_injection() {
    let json = r#"{
        "id": "GHSA-h4qu-5jpq-4mf5",
        "summary": "CRLF injection in urllib3",
        "aliases": ["CVE-2020-26137"],
        "affected": [{
            "package": { "ecosystem": "PyPI", "name": "urllib3" },
            "ranges": [{
                "type": "ECOSYSTEM",
                "events": [
                    { "introduced": "0" },
                    { "fixed": "1.25.9" }
                ]
            }]
        }]
    }"#;
    let adv = parse(json);

    assert_dispatch(&adv, 0, "1.24.0", true);
    assert_dispatch(&adv, 0, "1.25.8", true);
    assert_dispatch(&adv, 0, "1.25.9", false);
    assert_dispatch(&adv, 0, "1.26.0", false);
}

//
// Real shape from RUSTSEC-2020-0071 (time segfault, fixed in 0.2.23). The
// cargo matcher mirrors npm semver semantics with crate-specific edge
// cases (pre-release ordering, +metadata strip).
#[test]
fn corpus_crates_io_time_segfault() {
    let json = r#"{
        "id": "RUSTSEC-2020-0071",
        "summary": "Potential segfault in time crate",
        "affected": [{
            "package": { "ecosystem": "crates.io", "name": "time" },
            "ranges": [{
                "type": "SEMVER",
                "events": [
                    { "introduced": "0.2.7" },
                    { "fixed": "0.2.23" }
                ]
            }]
        }]
    }"#;
    let adv = parse(json);

    assert_dispatch(&adv, 0, "0.2.7", true);
    assert_dispatch(&adv, 0, "0.2.22", true);
    assert_dispatch(&adv, 0, "0.2.23", false);
    assert_dispatch(&adv, 0, "0.2.6", false);
    assert_dispatch(&adv, 0, "0.3.0", false);
}

//
// Real shape from GHSA-jfh8-c2jp-5v3q (log4j-core RCE, "Log4Shell"). The
// Maven scheme uses `pkg:maven/group:artifact` style names; fixed in 2.17.0
// against affected 2.0.0..2.16.0.
#[test]
fn corpus_maven_log4j_shell() {
    let json = r#"{
        "id": "GHSA-jfh8-c2jp-5v3q",
        "summary": "Remote code execution in Log4j",
        "aliases": ["CVE-2021-44228"],
        "affected": [{
            "package": { "ecosystem": "Maven", "name": "org.apache.logging.log4j:log4j-core" },
            "ranges": [{
                "type": "ECOSYSTEM",
                "events": [
                    { "introduced": "2.0" },
                    { "fixed": "2.17.0" }
                ]
            }]
        }]
    }"#;
    let adv = parse(json);

    assert_dispatch(&adv, 0, "2.14.1", true);
    assert_dispatch(&adv, 0, "2.16.0", true);
    assert_dispatch(&adv, 0, "2.17.0", false);
    assert_dispatch(&adv, 0, "1.2.17", false);
    assert_dispatch(&adv, 0, "2.17.1", false);
}

//
// Real shape from GO-2021-0089 (crypto/tls vulnerable to DoS via crafted
// handshake, fixed in 1.16.2). Go module versions are prefixed with `v`.
#[test]
fn corpus_go_stdlib_crypto_tls() {
    let json = r#"{
        "id": "GO-2021-0089",
        "summary": "crypto/tls denial of service",
        "affected": [{
            "package": { "ecosystem": "Go", "name": "stdlib" },
            "ranges": [{
                "type": "SEMVER",
                "events": [
                    { "introduced": "0" },
                    { "fixed": "1.16.2" }
                ]
            }]
        }]
    }"#;
    let adv = parse(json);

    assert_dispatch(&adv, 0, "1.15.0", true);
    assert_dispatch(&adv, 0, "1.16.1", true);
    assert_dispatch(&adv, 0, "1.16.2", false);
    assert_dispatch(&adv, 0, "1.17.0", false);
}

//
// Real shape from GHSA-65cv-r6x7-79hv (activesupport HTML sanitization
// bypass, fixed in 5.2.4.3 and 6.0.3.1). Multi-branch fix patterns are
// where RubyGems advisories tend to differ from npm/SemVer.
#[test]
fn corpus_rubygems_activesupport_xss() {
    let json = r#"{
        "id": "GHSA-65cv-r6x7-79hv",
        "summary": "Possible XSS in ActiveSupport html-escape",
        "aliases": ["CVE-2020-15169"],
        "affected": [{
            "package": { "ecosystem": "RubyGems", "name": "activesupport" },
            "ranges": [{
                "type": "ECOSYSTEM",
                "events": [
                    { "introduced": "5.2.0" },
                    { "fixed": "5.2.4.3" }
                ]
            }]
        }]
    }"#;
    let adv = parse(json);

    assert_dispatch(&adv, 0, "5.2.4.2", true);
    assert_dispatch(&adv, 0, "5.2.0", true);
    assert_dispatch(&adv, 0, "5.2.4.3", false);
    assert_dispatch(&adv, 0, "5.1.7", false);
}

//
// Common shape: advisory published before a fix exists. `fixed = None`
// means "every version >= introduced is affected, forever (until update)".
#[test]
fn corpus_npm_open_high_range_all_versions_above_introduced_match() {
    let json = r#"{
        "id": "GHSA-open-high",
        "summary": "Synthesised open-high advisory",
        "affected": [{
            "package": { "ecosystem": "npm", "name": "left-pad" },
            "ranges": [{
                "type": "SEMVER",
                "events": [
                    { "introduced": "1.3.0" }
                ]
            }]
        }]
    }"#;
    let adv = parse(json);

    assert_dispatch(&adv, 0, "1.3.0", true);
    assert_dispatch(&adv, 0, "9.0.0", true);
    assert_dispatch(&adv, 0, "1.2.9", false);
}
