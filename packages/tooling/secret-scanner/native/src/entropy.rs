// Shannon entropy for a byte slice, in bits/symbol.
// Port of gitleaks/detect/utils.go::shannonEntropy.

pub fn shannon(data: &str) -> f32 {
    if data.is_empty() {
        return 0.0;
    }
    let mut counts = [0u32; 256];
    let bytes = data.as_bytes();
    for &b in bytes {
        counts[b as usize] += 1;
    }
    let len = bytes.len() as f32;
    let mut entropy = 0.0f32;
    for &c in counts.iter() {
        if c == 0 {
            continue;
        }
        let p = c as f32 / len;
        entropy -= p * p.log2();
    }
    entropy
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_is_zero() {
        assert_eq!(shannon(""), 0.0);
    }

    #[test]
    fn uniform_high() {
        // Base64 alphabet chunk: high entropy
        let e = shannon("MIIEpAIBAAKCAQEA7f1h4uQ5");
        assert!(e > 3.5, "got {e}");
    }

    #[test]
    fn repeated_low() {
        assert!(shannon("aaaaaaaa") < 0.1);
    }
}
