//! Parse the v1 `osv-bloom` wire format.
//!
//! Layout (little-endian, 64-byte header + bitset):
//!
//! ```text
//! offset  size  field
//! 0       4     magic = b"OSVB"
//! 4       4     format_version (u32) = 1
//! 8       8     m  (u64) — bit count
//! 16      4     k  (u32) — hash count
//! 20      4     n  (u32) — entries inserted
//! 24      8     built_at_unix_seconds (u64)
//! 32      32    seed (BLAKE3 keyed-hash key)
//! 64      ceil(m/8)  bitset (LE bit order: bit i of byte j is `1 << (i % 8)`,
//!                            byte j = i / 8)
//! ```
//!
//! Decoder validates magic, version, and bitset length; rejects anything
//! else with a structured `BloomDecodeError` so the JS adapter can surface
//! a precise reason rather than a generic "decode failed".

use std::fmt;

pub const HEADER_BYTES: usize = 64;
pub const MAGIC: &[u8; 4] = b"OSVB";
pub const SUPPORTED_FORMAT_VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BloomDecodeError {
    /// Buffer is shorter than the fixed 64-byte header.
    HeaderTooShort { got: usize },
    /// First 4 bytes are not `OSVB`. Indicates a corrupt or wrong-format file.
    BadMagic { got: [u8; 4] },
    /// `format_version` is a value this build of vis was not compiled to
    /// understand. We refuse to probe rather than silently treat an
    /// incompatible bitset as if it were v1 — that would either spam false
    /// positives or miss real malicious packages.
    UnsupportedFormatVersion { got: u32, supported: u32 },
    /// `m` is zero. A zero-bit filter would div-by-zero in every probe.
    EmptyBitset,
    /// `k` is zero. A bloom with zero hash functions accepts everything.
    NoHashFunctions,
    /// Buffer length doesn't equal `HEADER_BYTES + ceil(m/8)`.
    BitsetLengthMismatch { expected: usize, got: usize },
}

impl fmt::Display for BloomDecodeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::HeaderTooShort { got } => {
                write!(f, "Bloom header truncated: got {got} bytes, need at least {HEADER_BYTES}")
            }
            Self::BadMagic { got } => {
                write!(
                    f,
                    "Bloom magic mismatch: got {got:02x?}, expected {MAGIC:02x?} ('OSVB')"
                )
            }
            Self::UnsupportedFormatVersion { got, supported } => {
                write!(
                    f,
                    "Bloom format_version {got} is not supported by this build (only v{supported}). Update vis or wait for the upstream filter to roll back."
                )
            }
            Self::EmptyBitset => write!(f, "Bloom header reports m=0 bits (empty filter)."),
            Self::NoHashFunctions => write!(f, "Bloom header reports k=0 hash functions."),
            Self::BitsetLengthMismatch { expected, got } => {
                write!(
                    f,
                    "Bloom bitset length mismatch: header says {expected} bytes, got {got}"
                )
            }
        }
    }
}

impl std::error::Error for BloomDecodeError {}

/// Decoded bloom filter. Owns its bitset so the source buffer can drop.
#[derive(Debug, Clone)]
pub struct BloomFilter {
    pub format_version: u32,
    /// Bit count. Probe indices reduce modulo this value.
    pub m: u64,
    /// Hash-function count. Each probe runs `k` rounds of double-hashing.
    pub k: u32,
    /// Entry count the builder inserted. Not load-bearing for probes; we
    /// expose it so `vis advisories bloom status` can report it.
    pub n: u32,
    /// Build timestamp recorded by the upstream builder.
    pub built_at_unix_seconds: u64,
    /// 32-byte BLAKE3 keyed-hash key. Public + deterministic upstream; we
    /// hash the key bytes into a `blake3::Hash` only at probe time.
    pub seed: [u8; 32],
    /// Bit storage; LE bit order (`byte = i / 8`, `bit = 1 << (i % 8)`).
    pub bitset: Vec<u8>,
}

impl BloomFilter {
    /// Parse the wire-format buffer. The buffer is consumed (cloned into
    /// the bitset field) so callers can drop a memory-mapped file or
    /// fetch buffer immediately after.
    pub fn decode(bytes: &[u8]) -> Result<Self, BloomDecodeError> {
        if bytes.len() < HEADER_BYTES {
            return Err(BloomDecodeError::HeaderTooShort { got: bytes.len() });
        }

        let mut magic = [0u8; 4];
        magic.copy_from_slice(&bytes[0..4]);

        if &magic != MAGIC {
            return Err(BloomDecodeError::BadMagic { got: magic });
        }

        let format_version = u32::from_le_bytes(bytes[4..8].try_into().expect("4 bytes"));

        if format_version != SUPPORTED_FORMAT_VERSION {
            return Err(BloomDecodeError::UnsupportedFormatVersion {
                got: format_version,
                supported: SUPPORTED_FORMAT_VERSION,
            });
        }

        let m = u64::from_le_bytes(bytes[8..16].try_into().expect("8 bytes"));

        if m == 0 {
            return Err(BloomDecodeError::EmptyBitset);
        }

        let k = u32::from_le_bytes(bytes[16..20].try_into().expect("4 bytes"));

        if k == 0 {
            return Err(BloomDecodeError::NoHashFunctions);
        }

        let n = u32::from_le_bytes(bytes[20..24].try_into().expect("4 bytes"));
        let built_at_unix_seconds = u64::from_le_bytes(bytes[24..32].try_into().expect("8 bytes"));

        let mut seed = [0u8; 32];
        seed.copy_from_slice(&bytes[32..64]);

        let expected_bitset_bytes = m.div_ceil(8) as usize;
        let expected_total = HEADER_BYTES + expected_bitset_bytes;

        if bytes.len() != expected_total {
            return Err(BloomDecodeError::BitsetLengthMismatch {
                expected: expected_total,
                got: bytes.len(),
            });
        }

        let bitset = bytes[HEADER_BYTES..].to_vec();

        Ok(Self {
            format_version,
            m,
            k,
            n,
            built_at_unix_seconds,
            seed,
            bitset,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn header_bytes(m: u64, k: u32, n: u32, built_at: u64, seed: [u8; 32]) -> Vec<u8> {
        let mut out = Vec::with_capacity(HEADER_BYTES);
        out.extend_from_slice(MAGIC);
        out.extend_from_slice(&SUPPORTED_FORMAT_VERSION.to_le_bytes());
        out.extend_from_slice(&m.to_le_bytes());
        out.extend_from_slice(&k.to_le_bytes());
        out.extend_from_slice(&n.to_le_bytes());
        out.extend_from_slice(&built_at.to_le_bytes());
        out.extend_from_slice(&seed);
        out
    }

    fn synthetic_filter(m: u64) -> Vec<u8> {
        let mut buf = header_bytes(m, 7, 0, 1_700_000_000, [0xAB; 32]);
        let bitset_len = m.div_ceil(8) as usize;
        buf.extend(std::iter::repeat_n(0u8, bitset_len));
        buf
    }

    #[test]
    fn decodes_valid_header() {
        let buf = synthetic_filter(64);
        let decoded = BloomFilter::decode(&buf).expect("decode");

        assert_eq!(decoded.format_version, 1);
        assert_eq!(decoded.m, 64);
        assert_eq!(decoded.k, 7);
        assert_eq!(decoded.n, 0);
        assert_eq!(decoded.built_at_unix_seconds, 1_700_000_000);
        assert_eq!(decoded.seed, [0xAB; 32]);
        assert_eq!(decoded.bitset.len(), 8);
    }

    #[test]
    fn rejects_truncated_header() {
        let result = BloomFilter::decode(&[0; 60]);

        assert!(matches!(
            result,
            Err(BloomDecodeError::HeaderTooShort { got: 60 })
        ));
    }

    #[test]
    fn rejects_bad_magic() {
        let mut buf = synthetic_filter(64);
        buf[0] = b'X';

        let result = BloomFilter::decode(&buf);

        assert!(matches!(result, Err(BloomDecodeError::BadMagic { .. })));
    }

    #[test]
    fn rejects_future_format_version() {
        let mut buf = synthetic_filter(64);
        buf[4..8].copy_from_slice(&99u32.to_le_bytes());

        let result = BloomFilter::decode(&buf);

        assert!(matches!(
            result,
            Err(BloomDecodeError::UnsupportedFormatVersion { got: 99, supported: 1 })
        ));
    }

    #[test]
    fn rejects_zero_m() {
        let mut buf = header_bytes(0, 7, 0, 0, [0; 32]);
        // Header-only is legal length when m=0, but EmptyBitset must fire first.
        buf.extend(std::iter::empty::<u8>());

        let result = BloomFilter::decode(&buf);

        assert!(matches!(result, Err(BloomDecodeError::EmptyBitset)));
    }

    #[test]
    fn rejects_zero_k() {
        let mut buf = header_bytes(64, 0, 0, 0, [0; 32]);
        buf.extend(std::iter::repeat_n(0u8, 8));

        let result = BloomFilter::decode(&buf);

        assert!(matches!(result, Err(BloomDecodeError::NoHashFunctions)));
    }

    #[test]
    fn rejects_bitset_length_mismatch() {
        // header advertises m=64 (8 bytes of bitset), buffer only has 4
        let mut buf = header_bytes(64, 7, 0, 0, [0; 32]);
        buf.extend(std::iter::repeat_n(0u8, 4));

        let result = BloomFilter::decode(&buf);

        assert!(matches!(
            result,
            Err(BloomDecodeError::BitsetLengthMismatch { expected: 72, got: 68 })
        ));
    }
}
