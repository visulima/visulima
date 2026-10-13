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

use super::{matcher_for, row_matches};
use crate::advisories::osv::Advisory;

fn parse(json: &str) -> Advisory {
    serde_json::from_str(json).expect("real OSV record must deserialize")
}

fn assert_dispatch(advisory: &Advisory, affected_idx: usize, version: &str, expected_affected: bool) {
    let affected = &advisory.affected[affected_idx];
    let package = affected.package.as_ref().expect("corpus advisory names a package");
    let matcher = matcher_for(&package.ecosystem)
        .unwrap_or_else(|| panic!("no matcher registered for ecosystem {}", package.ecosystem));

    let mut any_match = false;
    for range in &affected.ranges {
        for pair in range.to_pairs() {
            if row_matches(matcher, version, &pair.introduced, pair.fixed.as_deref(), pair.last_affected.as_deref()) {
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
        package.ecosystem, version, advisory.id,
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

//
// Real shape from GHSA-4rgh-jx4f-qfcq (http header injection, fixed in
// 0.13.3). Pub records use `ECOSYSTEM` ranges with introduced/fixed events,
// and the versions are plain SemVer.
#[test]
fn corpus_pub_http_header_injection() {
    let json = r#"{
        "id": "GHSA-4rgh-jx4f-qfcq",
        "summary": "http before 0.13.3 vulnerable to header injection",
        "aliases": ["CVE-2020-35669"],
        "affected": [{
            "package": { "ecosystem": "Pub", "name": "http" },
            "ranges": [{
                "type": "ECOSYSTEM",
                "events": [
                    { "introduced": "0" },
                    { "fixed": "0.13.3" }
                ]
            }]
        }]
    }"#;
    let adv = parse(json);

    assert_dispatch(&adv, 0, "0.10.0", true);
    assert_dispatch(&adv, 0, "0.13.2", true);
    assert_dispatch(&adv, 0, "0.13.3", false);
    assert_dispatch(&adv, 0, "0.13.4", false);
}

//
// Real shape from GHSA-vm9r-h74p-hg97 (jose untrusted JWK header key
// acceptance, fixed in 0.3.5+1). The fix carries a build suffix, so a bare
// 0.3.5 is still affected.
#[test]
fn corpus_pub_jose_build_suffix_fix() {
    let json = r#"{
        "id": "GHSA-vm9r-h74p-hg97",
        "summary": "jose vulnerable to untrusted JWK header key acceptance during signature verification",
        "affected": [{
            "package": { "ecosystem": "Pub", "name": "jose" },
            "ranges": [{
                "type": "ECOSYSTEM",
                "events": [
                    { "introduced": "0" },
                    { "fixed": "0.3.5+1" }
                ]
            }]
        }]
    }"#;
    let adv = parse(json);

    assert_dispatch(&adv, 0, "0.3.4", true);
    assert_dispatch(&adv, 0, "0.3.5", true);
    assert_dispatch(&adv, 0, "0.3.5+1", false);
    assert_dispatch(&adv, 0, "0.3.6", false);
}

// Real shape from GHSA-9v85-q87q-g4vg (archive, fixed in 3.3.8). The advisory
// is written as `<= 3.3.7` in the GitHub database and as introduced/fixed in
// OSV, so the boundary is 3.3.7 affected and 3.3.8 clean.
#[test]
fn corpus_pub_archive_upper_boundary() {
    let json = r#"{
        "id": "GHSA-9v85-q87q-g4vg",
        "summary": "archive affected by a path traversal",
        "affected": [{
            "package": { "ecosystem": "Pub", "name": "archive" },
            "ranges": [{
                "type": "ECOSYSTEM",
                "events": [
                    { "introduced": "0" },
                    { "fixed": "3.3.8" }
                ]
            }]
        }]
    }"#;
    let adv = parse(json);

    assert_dispatch(&adv, 0, "3.3.7", true);
    assert_dispatch(&adv, 0, "3.3.8", false);
}

// Real shape from GHSA-fmj7-7gfw-64pg (agent_dart, fixed in 1.0.0-dev.29). The
// boundary is a pre-release: 1.0.0-dev.28 is affected, 1.0.0-dev.29 is clean,
// and the final 1.0.0 is clean as well.
#[test]
fn corpus_pub_agent_dart_prerelease_boundary() {
    let json = r#"{
        "id": "GHSA-fmj7-7gfw-64pg",
        "summary": "agent_dart affected by a prerelease-era vulnerability",
        "affected": [{
            "package": { "ecosystem": "Pub", "name": "agent_dart" },
            "ranges": [{
                "type": "ECOSYSTEM",
                "events": [
                    { "introduced": "0" },
                    { "fixed": "1.0.0-dev.29" }
                ]
            }]
        }]
    }"#;
    let adv = parse(json);

    assert_dispatch(&adv, 0, "1.0.0-dev.28", true);
    assert_dispatch(&adv, 0, "1.0.0-dev.29", false);
    assert_dispatch(&adv, 0, "1.0.0", false);
}

// Real shape from GHSA-35jh-r3h4-6jhm (lodash.template command injection).
// The package's range is `last_affected: 4.5.0`, an inclusive bound, so
// 4.5.0 itself is affected and 4.5.1 is clean. Recorded in the OSV dump as
// `last_affected` (not `fixed`).
#[test]
fn corpus_npm_lodash_template_last_affected_is_inclusive() {
    let json = r#"{
  "id": "GHSA-35jh-r3h4-6jhm",
  "summary": "Command Injection in lodash",
  "aliases": [
    "CVE-2021-23337",
    "CVE-2026-4800",
    "GHSA-r5fr-rjxr-66jc"
  ],
  "affected": [
    {
      "package": {
        "name": "lodash.template",
        "ecosystem": "npm",
        "purl": "pkg:npm/lodash.template"
      },
      "ranges": [
        {
          "type": "SEMVER",
          "events": [
            {
              "introduced": "0"
            },
            {
              "last_affected": "4.5.0"
            }
          ]
        }
      ],
      "database_specific": {
        "source": "https://github.com/github/advisory-database/blob/main/advisories/github-reviewed/2021/05/GHSA-35jh-r3h4-6jhm/GHSA-35jh-r3h4-6jhm.json"
      }
    }
  ]
}"#;
    let advisory = parse(json);
    assert_dispatch(&advisory, 0, "4.5.0", true);
    assert_dispatch(&advisory, 0, "4.4.9", true);
    assert_dispatch(&advisory, 0, "4.5.1", false);
}

// Real shape from GHSA-g454-wj9r-jpg4 (marmelroy/Zip, SwiftURL). The OSV
// range is `last_affected: 2.1.2`, so 2.1.2 is affected and 2.1.3 is clean.
#[test]
fn corpus_swifturl_zip_last_affected_is_inclusive() {
    let json = r#"{"id":"GHSA-g454-wj9r-jpg4","summary":"Path traversal in Zip Swift","aliases":["CVE-2023-39135"],"affected":[{"package":{"name":"github.com/marmelroy/Zip","ecosystem":"SwiftURL","purl":"pkg:swift/github.com/marmelroy/Zip"},"ranges":[{"type":"SEMVER","events":[{"introduced":"0"},{"last_affected":"2.1.2"}]}],"database_specific":{"source":"https://github.com/github/advisory-database/blob/main/advisories/github-reviewed/2023/08/GHSA-g454-wj9r-jpg4/GHSA-g454-wj9r-jpg4.json"}}]}"#;
    let advisory = parse(json);
    assert_dispatch(&advisory, 0, "2.1.1", true);
    assert_dispatch(&advisory, 0, "2.1.2", true);
    assert_dispatch(&advisory, 0, "2.1.3", false);
}

// Real shape from GHSA-hh56-x62g-gvhc (CLEditor, NuGet). The range is
// `last_affected: 1.4.5`, an inclusive bound: 1.4.5 is affected and 1.4.6
// is clean.
#[test]
fn corpus_nuget_cleditor_last_affected_is_inclusive() {
    let json = r#"{"id":"GHSA-hh56-x62g-gvhc","summary":"Cross-site scripting in CLEditor","aliases":["CVE-2019-1010113"],"affected":[{"package":{"name":"CLEditor","ecosystem":"NuGet","purl":"pkg:nuget/CLEditor"},"ranges":[{"type":"ECOSYSTEM","events":[{"introduced":"0"},{"last_affected":"1.4.5"}]}],"versions":["1.3.0","1.4.1","1.4.3","1.4.4","1.4.5"],"database_specific":{"source":"https://github.com/github/advisory-database/blob/main/advisories/github-reviewed/2019/07/GHSA-hh56-x62g-gvhc/GHSA-hh56-x62g-gvhc.json"}}]}"#;
    let advisory = parse(json);
    assert_dispatch(&advisory, 0, "1.4.4", true);
    assert_dispatch(&advisory, 0, "1.4.5", true);
    assert_dispatch(&advisory, 0, "1.4.6", false);
}

// Real shape from GHSA-8336-mxp6-v5h9 (OPCFoundation.NetStandard.Opc.Ua,
// NuGet). Four-part fixed version 1.4.353.15: the fourth part decides the
// boundary.
#[test]
fn corpus_nuget_four_part_fixed_version() {
    let json = r#"{"id":"GHSA-8336-mxp6-v5h9","summary":"Moderate severity vulnerability that affects OPCFoundation.NetStandard.Opc.Ua","aliases":["CVE-2018-12087"],"affected":[{"package":{"name":"OPCFoundation.NetStandard.Opc.Ua","ecosystem":"NuGet","purl":"pkg:nuget/OPCFoundation.NetStandard.Opc.Ua"},"ranges":[{"type":"ECOSYSTEM","events":[{"introduced":"0"},{"fixed":"1.4.353.15"}]}],"versions":["0.4.0","0.4.1","0.4.3","0.4.4","0.4.5","1.3.348","1.3.349","1.3.350","1.3.350.1","1.3.350.3","1.3.350.4","1.3.350.5","1.3.350.6","1.3.351.7","1.3.352.10","1.3.352.11","1.3.352.12","1.3.352.9","1.4.353.13","1.4.353.14"],"database_specific":{"last_known_affected_version_range":"<= 1.4.352.12","source":"https://github.com/github/advisory-database/blob/main/advisories/github-reviewed/2018/10/GHSA-8336-mxp6-v5h9/GHSA-8336-mxp6-v5h9.json"}}]}"#;
    let advisory = parse(json);
    assert_dispatch(&advisory, 0, "1.4.353.14", true);
    assert_dispatch(&advisory, 0, "1.4.353.15", false);
    assert_dispatch(&advisory, 0, "1.4.353", true);
}

//
// Real shape from EEF-CVE-2026-32689 (phoenix long-poll memory exhaustion,
// fixed in 1.7.22 and 1.8.6). Hex advisories from the ERLEF feed use SEMVER
// ranges with introduced and fixed events. The trailing GIT affected entry has
// no `package` member, which must deserialize and be skipped at ingest.
#[test]
fn corpus_hex_phoenix_long_poll_two_branch_fix() {
    let json = r#"{
  "id": "EEF-CVE-2026-32689",
  "summary": "Long-poll NDJSON body splitting causes unbounded memory allocation in Phoenix",
  "aliases": [
    "CVE-2026-32689",
    "GHSA-628h-q48j-jr6q"
  ],
  "affected": [
    {
      "package": {
        "name": "phoenix",
        "ecosystem": "Hex",
        "purl": "pkg:hex/phoenix"
      },
      "ranges": [
        {
          "type": "SEMVER",
          "events": [
            {
              "introduced": "1.7.0"
            },
            {
              "fixed": "1.7.22"
            }
          ]
        },
        {
          "type": "SEMVER",
          "events": [
            {
              "introduced": "1.8.0"
            },
            {
              "fixed": "1.8.6"
            }
          ]
        }
      ]
    },
    {
      "ranges": [
        {
          "type": "GIT",
          "repo": "https://github.com/phoenixframework/phoenix",
          "events": [
            { "introduced": "2674c6ea30634667f9b09966b90269393b445953" },
            { "fixed": "1a67c61ff9ce0a7711662ac7354861917a7c80f7" }
          ]
        }
      ]
    }
  ]
}"#;
    let adv = parse(json);

    assert_dispatch(&adv, 0, "1.6.9", false);
    assert_dispatch(&adv, 0, "1.7.0", true);
    assert_dispatch(&adv, 0, "1.7.21", true);
    assert_dispatch(&adv, 0, "1.7.22", false);
    assert_dispatch(&adv, 0, "1.8.5", true);
    assert_dispatch(&adv, 0, "1.8.6", false);
}
