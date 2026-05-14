//! Probe a decoded `BloomFilter` for `(name, bucket)` membership.
//!
//! Hashing scheme (matches `endevco/osv-bloom`):
//!
//! 1. `digest = blake3::keyed_hash(seed, name || 0x00 || bucket)`
//! 2. `h1 = u64::from_le_bytes(digest[0..8])`
//! 3. `h2 = u64::from_le_bytes(digest[8..16])`
//! 4. For `i in 0..k`: `bit_index = (h1 + i*h2) mod m`
//!    — known as Kirsch–Mitzenmacher double hashing.
//! 5. Hit iff every `bit_index` is set.

use super::decoder::BloomFilter;

/// Returns `true` when `(name, bucket)` *might* be in the filter. `false`
/// is authoritative: the entry was definitely not inserted. A `true`
/// return is a *probable* hit; the upstream FPR is ~0.1% so the caller
/// must escalate to an authoritative source.
pub fn contains(filter: &BloomFilter, name: &str, bucket: &str) -> bool {
    let digest = hash_key(&filter.seed, name, bucket);
    let h1 = u64::from_le_bytes(digest[0..8].try_into().expect("8 bytes"));
    let h2 = u64::from_le_bytes(digest[8..16].try_into().expect("8 bytes"));

    for i in 0..filter.k {
        // (h1 + i*h2) mod m — wrapping_mul/add keep this branch-free on
        // 64-bit; the final `%` reduces into the bitset range.
        let bit_index = h1.wrapping_add((i as u64).wrapping_mul(h2)) % filter.m;
        let byte_index = (bit_index / 8) as usize;
        let bit_in_byte = (bit_index % 8) as u8;

        if filter.bitset[byte_index] & (1u8 << bit_in_byte) == 0 {
            return false;
        }
    }

    true
}

fn hash_key(seed: &[u8; 32], name: &str, bucket: &str) -> [u8; 32] {
    let mut hasher = blake3::Hasher::new_keyed(seed);
    hasher.update(name.as_bytes());
    hasher.update(&[0u8]);
    hasher.update(bucket.as_bytes());
    *hasher.finalize().as_bytes()
}

/// Test-only helper: build a bloom filter by inserting `entries` against
/// the same hashing scheme `contains` reads. Mirrors the upstream
/// builder closely enough that decoder + probe round-trip end-to-end.
#[cfg(test)]
pub(crate) fn build_for_tests(seed: [u8; 32], m: u64, k: u32, entries: &[(&str, &str)]) -> BloomFilter {
    let bitset_bytes = m.div_ceil(8) as usize;
    let mut bitset = vec![0u8; bitset_bytes];

    for (name, bucket) in entries {
        let digest = hash_key(&seed, name, bucket);
        let h1 = u64::from_le_bytes(digest[0..8].try_into().expect("8 bytes"));
        let h2 = u64::from_le_bytes(digest[8..16].try_into().expect("8 bytes"));

        for i in 0..k {
            let bit_index = h1.wrapping_add((i as u64).wrapping_mul(h2)) % m;
            let byte_index = (bit_index / 8) as usize;
            let bit_in_byte = (bit_index % 8) as u8;

            bitset[byte_index] |= 1u8 << bit_in_byte;
        }
    }

    BloomFilter {
        format_version: 1,
        m,
        k,
        n: entries.len() as u32,
        built_at_unix_seconds: 0,
        seed,
        bitset,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_inserted_entries() {
        let filter = build_for_tests(
            [0x42; 32],
            8192,
            7,
            &[("evil-pkg", "1"), ("trojan", "0.3"), ("backdoor", "*")],
        );

        assert!(contains(&filter, "evil-pkg", "1"));
        assert!(contains(&filter, "trojan", "0.3"));
        assert!(contains(&filter, "backdoor", "*"));
    }

    #[test]
    fn rejects_uninserted_entries() {
        let filter = build_for_tests([0x42; 32], 8192, 7, &[("evil-pkg", "1")]);

        // Different bucket
        assert!(!contains(&filter, "evil-pkg", "2"));
        // Different name
        assert!(!contains(&filter, "good-pkg", "1"));
        // Different name and bucket
        assert!(!contains(&filter, "unknown", "*"));
    }

    #[test]
    fn bucket_separator_prevents_collision() {
        // Without the 0x00 separator, ("ab", "cd") and ("abc", "d") would
        // hash identically. Verify the separator is in effect.
        let filter = build_for_tests([0x42; 32], 8192, 7, &[("ab", "cd")]);

        assert!(contains(&filter, "ab", "cd"));
        assert!(!contains(&filter, "abc", "d"));
    }

    #[test]
    fn wildcard_bucket_roundtrips() {
        let filter = build_for_tests([0x42; 32], 4096, 5, &[("evil", "*")]);

        assert!(contains(&filter, "evil", "*"));
        assert!(!contains(&filter, "evil", "1"));
    }

    #[test]
    fn different_seed_produces_different_membership() {
        let entries = &[("evil", "1")];
        let filter_a = build_for_tests([0xAA; 32], 64, 7, entries);
        let filter_b = build_for_tests([0xBB; 32], 64, 7, entries);

        // Both should report the inserted entry.
        assert!(contains(&filter_a, "evil", "1"));
        assert!(contains(&filter_b, "evil", "1"));

        // The bitsets should differ — the seed enters the keyed hash.
        assert_ne!(filter_a.bitset, filter_b.bitset);
    }
}
