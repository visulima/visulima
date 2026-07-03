/**
 * Shared xxh3-128 hashing utilities.
 *
 * Uses the same algorithm (xxh3-128) as the native Rust addon,
 * ensuring identical hash output regardless of execution mode.
 *
 * Output format: 32-character lowercase hex string (128-bit hash).
 *
 * The XXH3_128 implementation below is vendored from xxh3-ts v2.0.1
 * (BSD-2-Clause, https://github.com/i404788/xxh3-ts) and converted
 * to TypeScript. It uses TC39 BigInt for 128-bit arithmetic.
 */

/* eslint-disable no-bitwise, no-param-reassign, @typescript-eslint/no-shadow, sonarjs/cognitive-complexity */

// ─── Vendored xxh3-128 implementation ──────────────────────────────────────

const MASK_128 = (1n << 128n) - 1n;
const MASK_64 = (1n << 64n) - 1n;
const MASK_32 = (1n << 32n) - 1n;

const PRIME32_1 = 0x9E3779B1n;
const PRIME32_2 = 0x85EBCA77n;
const PRIME32_3 = 0xC2B2AE3Dn;
const PRIME64_1 = 0x9E3779B185EBCA87n;
const PRIME64_2 = 0xC2B2AE3D27D4EB4Fn;
const PRIME64_3 = 0x165667B19E3779F9n;
const PRIME64_4 = 0x85EBCA77C2B2AE63n;
const PRIME64_5 = 0x27D4EB2F165667C5n;
const PRIME_MX1 = 0x165667919E3779F9n;
const PRIME_MX2 = 0x9FB21C651E98DF25n;

const STRIPE_LEN = 64;
const ACC_NB = STRIPE_LEN / 8;
const U64 = 8;

const KKEY = Buffer.from(
    "b8fe6c3923a44bbe7c01812cf721ad1cded46de9839097db7240a4a4b7b3671fcb79e64eccc0e578825ad07dccff7221b8084674f743248ee03590e6813a264c3c2852bb91c300cb88d0658b1b532ea371644897a20df94e3819ef46a9deacd8a8fa763fe39c343ff9dcbbc7c70b4f1d8a51e04bcdb45931c89f7ec9d9787364eac5ac8334d3ebc3c581a0fffa1363eb170ddd51b7f0da49d316552629d4689e2b16be587d47a1fc8ff8b8d17ad031ce45cb3a8f95160428afd7fbcabb4b407e",
    "hex",
);

const getView = (buf: Buffer, offset = 0): Buffer => Buffer.from(buf.buffer, buf.byteOffset + offset, buf.length - offset);

// Allocation-free 64-bit byte swap (pure BigInt shift/mask), mirroring bswap32.
const bswap64 = (a: bigint): bigint => {
    let v = a & MASK_64;

    v = ((v & 0x00000000FFFFFFFFn) << 32n) | ((v & 0xFFFFFFFF00000000n) >> 32n);
    v = ((v & 0x0000FFFF0000FFFFn) << 16n) | ((v & 0xFFFF0000FFFF0000n) >> 16n);
    v = ((v & 0x00FF00FF00FF00FFn) << 8n) | ((v & 0xFF00FF00FF00FF00n) >> 8n);

    return v & MASK_64;
};

const bswap32 = (a: bigint): bigint => {
    let v = a;

    v = ((v & 0x0000FFFFn) << 16n) | ((v & 0xFFFF0000n) >> 16n);
    v = ((v & 0x00FF00FFn) << 8n) | ((v & 0xFF00FF00n) >> 8n);

    return v;
};

const multU32ToU64 = (a: bigint, b: bigint): bigint => ((a & MASK_32) * (b & MASK_32)) & MASK_64;

const rotl32 = (a: bigint, b: bigint): bigint => ((a << b) | (a >> (32n - b))) & MASK_32;

const xorshift64 = (b: bigint, shift: bigint): bigint => b ^ (b >> shift);

const inv64 = (x: bigint): bigint => (~x + 1n) & MASK_64;

const mul128Fold64 = (a: bigint, b: bigint): bigint => {
    const lll = (a * b) & MASK_128;

    return (lll & MASK_64) ^ (lll >> 64n);
};

const avalanche = (h: bigint): bigint => {
    let v = h;

    v ^= v >> 37n;
    v = (v * PRIME_MX1) & MASK_64;
    v ^= v >> 32n;

    return v;
};

const avalanche64 = (h: bigint): bigint => {
    let v = h;

    v ^= v >> 33n;
    v = (v * PRIME64_2) & MASK_64;
    v ^= v >> 29n;
    v = (v * PRIME64_3) & MASK_64;
    v ^= v >> 32n;

    return v;
};

// `dataOffset` / `keyOffset` are byte offsets into the shared buffers, threaded
// through to avoid allocating per-stripe Buffer views on the long-hash hot path.
const accumulate512 = (acc: BigUint64Array, data: Buffer, key: Buffer, dataOffset = 0, keyOffset = 0): BigUint64Array => {
    for (let i = 0; i < ACC_NB; i++) {
        const dataVal = data.readBigUInt64LE(dataOffset + i * 8);
        const dataKey = dataVal ^ key.readBigUInt64LE(keyOffset + i * 8);

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        acc[i ^ 1]! += dataVal;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        acc[i]! += multU32ToU64(dataKey, dataKey >> 32n);
    }

    return acc;
};

const accumulate = (acc: BigUint64Array, data: Buffer, key: Buffer, nbStripes: number, dataOffset = 0): BigUint64Array => {
    for (let i = 0; i < nbStripes; i++) {
        accumulate512(acc, data, key, dataOffset + i * STRIPE_LEN, i * 8);
    }

    return acc;
};

const scrambleAcc = (acc: BigUint64Array, key: Buffer, keyOffset = 0): BigUint64Array => {
    for (let i = 0; i < ACC_NB; i++) {
        const key64 = key.readBigUInt64LE(keyOffset + i * 8);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        let acc64 = acc[i]!;

        acc64 = xorshift64(acc64, 47n);
        acc64 ^= key64;
        acc64 *= PRIME32_1;
        acc[i] = acc64 & MASK_64;
    }

    return acc;
};

// `accStart` indexes into `acc` and `keyOffset` into `key` to avoid the four
// `BigUint64Array` copies (`acc.slice(...)`) and Buffer views per merge.
const mix2Accs = (acc: BigUint64Array, accStart: number, key: Buffer, keyOffset: number): bigint =>
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    mul128Fold64(acc[accStart]! ^ key.readBigUInt64LE(keyOffset), acc[accStart + 1]! ^ key.readBigUInt64LE(keyOffset + U64));

const mergeAccs = (acc: BigUint64Array, key: Buffer, keyOffset: number, start: bigint): bigint => {
    let result64 = start;

    result64 += mix2Accs(acc, 0, key, keyOffset + 0);
    result64 += mix2Accs(acc, 2, key, keyOffset + 16);
    result64 += mix2Accs(acc, 4, key, keyOffset + 32);
    result64 += mix2Accs(acc, 6, key, keyOffset + 48);

    return avalanche(result64 & MASK_64);
};

const hashLong = (acc: BigUint64Array, data: Buffer, secret: Buffer): BigUint64Array => {
    const nbStripesPerBlock = Math.floor((secret.byteLength - STRIPE_LEN) / 8);
    const blockLen = STRIPE_LEN * nbStripesPerBlock;
    const nbBlocks = Math.floor((data.byteLength - 1) / blockLen);

    for (let i = 0; i < nbBlocks; i++) {
        accumulate(acc, data, secret, nbStripesPerBlock, i * blockLen);
        scrambleAcc(acc, secret, secret.byteLength - STRIPE_LEN);
    }

    const nbStripes = Math.floor((data.byteLength - 1 - blockLen * nbBlocks) / STRIPE_LEN);

    accumulate(acc, data, secret, nbStripes, nbBlocks * blockLen);
    accumulate512(acc, data, secret, data.byteLength - STRIPE_LEN, secret.byteLength - STRIPE_LEN - 7);

    return acc;
};

/**
 * Derives a per-seed custom secret, mirroring the reference
 * `XXH3_initCustomSecret`. Required so that seeded hashes of inputs > 240 bytes
 * are correct: the long-hash path otherwise ignores the seed entirely.
 *
 * For each 16-byte lane of the default secret, the low 64 bits get `+ seed` and
 * the high 64 bits get `- seed` (mod 2^64), written back little-endian.
 */
const initCustomSecret = (seed: bigint): Buffer => {
    const customSecret = Buffer.from(KKEY);
    const nbRounds = KKEY.byteLength >> 4;

    for (let i = 0; i < nbRounds; i++) {
        const lo = (customSecret.readBigUInt64LE(i * 16) + seed) & MASK_64;
        const hi = (customSecret.readBigUInt64LE(i * 16 + 8) - seed) & MASK_64;

        customSecret.writeBigUInt64LE(lo, i * 16);
        customSecret.writeBigUInt64LE(hi, i * 16 + 8);
    }

    return customSecret;
};

const hashLong128b = (data: Buffer, secret: Buffer): bigint => {
    const acc = new BigUint64Array([PRIME32_3, PRIME64_1, PRIME64_2, PRIME64_3, PRIME64_4, PRIME32_2, PRIME64_5, PRIME32_1]);

    hashLong(acc, data, secret);

    const low64 = mergeAccs(acc, secret, 11, (BigInt(data.byteLength) * PRIME64_1) & MASK_64);
    const high64 = mergeAccs(
        acc,
        secret,
        secret.byteLength - STRIPE_LEN - 11,
        ~(BigInt(data.byteLength) * PRIME64_2) & MASK_64,
    );

    return (high64 << 64n) | low64;
};

const mix16B = (data: Buffer, key: Buffer, seed: bigint): bigint =>
    mul128Fold64(
        (data.readBigUInt64LE(0) ^ (key.readBigUInt64LE(0) + seed)) & MASK_64,
        (data.readBigUInt64LE(8) ^ (key.readBigUInt64LE(8) - seed)) & MASK_64,
    );

const mix32B = (acc: bigint, data1: Buffer, data2: Buffer, key: Buffer, seed: bigint): bigint => {
    let accl = acc & MASK_64;
    let acch = (acc >> 64n) & MASK_64;

    accl += mix16B(data1, key, seed);
    accl ^= data2.readBigUInt64LE(0) + data2.readBigUInt64LE(8);
    accl &= MASK_64;
    acch += mix16B(data2, getView(key, 16), seed);
    acch ^= data1.readBigUInt64LE(0) + data1.readBigUInt64LE(8);
    acch &= MASK_64;

    return (acch << 64n) | accl;
};

const len1to3_128b = (data: Buffer, key32: Buffer, seed: bigint): bigint => {
    const len = data.byteLength;
    // NOTE: each term must be widened to BigInt *before* the shift. `byte << 24`
    // in JS number space overflows int32 when the byte is >= 0x80 (e.g.
    // `0xbf << 24` is negative), which would corrupt the low-64 lane of
    // `combined` and diverge from the reference/native xxh3 implementation.
    const combined
        = BigInt(data.readUInt8(len - 1))
            | (BigInt(len) << 8n)
            | (BigInt(data.readUInt8(0)) << 16n)
            | (BigInt(data.readUInt8(len >> 1)) << 24n);
    const blow = (BigInt(key32.readUInt32LE(0)) ^ BigInt(key32.readUInt32LE(4))) + seed;
    const low = (combined ^ blow) & MASK_64;
    const bhigh = (BigInt(key32.readUInt32LE(8)) ^ BigInt(key32.readUInt32LE(12))) - seed;
    const high = (rotl32(bswap32(combined), 13n) ^ bhigh) & MASK_64;

    return ((avalanche64(high) & MASK_64) << 64n) | avalanche64(low);
};

const len4to8_128b = (data: Buffer, key32: Buffer, seed: bigint): bigint => {
    const len = data.byteLength;
    const l1 = data.readUInt32LE(0);
    const l2 = data.readUInt32LE(len - 4);
    const l64 = BigInt(l1) | (BigInt(l2) << 32n);
    const bitflip = ((key32.readBigUInt64LE(16) ^ key32.readBigUInt64LE(24)) + seed) & MASK_64;
    const keyed = l64 ^ bitflip;
    let m128 = (keyed * (PRIME64_1 + (BigInt(len) << 2n))) & MASK_128;

    m128 += (m128 & MASK_64) << 65n;
    m128 &= MASK_128;
    m128 ^= m128 >> 67n;

    return xorshift64((xorshift64(m128 & MASK_64, 35n) * PRIME_MX2) & MASK_64, 28n) | (avalanche(m128 >> 64n) << 64n);
};

const len9to16_128b = (data: Buffer, key64: Buffer, seed: bigint): bigint => {
    const len = data.byteLength;
    const bitflipl = ((key64.readBigUInt64LE(32) ^ key64.readBigUInt64LE(40)) + seed) & MASK_64;
    const bitfliph = ((key64.readBigUInt64LE(48) ^ key64.readBigUInt64LE(56)) - seed) & MASK_64;
    const ll1 = data.readBigUInt64LE();
    let ll2 = data.readBigUInt64LE(len - 8);
    let m128 = (ll1 ^ ll2 ^ bitflipl) * PRIME64_1;
    const m128l = (m128 & MASK_64) + (BigInt(len - 1) << 54n);

    m128 = (m128 & (MASK_128 ^ MASK_64)) | m128l;
    ll2 ^= bitfliph;
    m128 += (ll2 + (ll2 & MASK_32) * (PRIME32_2 - 1n)) << 64n;
    m128 &= MASK_128;
    m128 ^= bswap64(m128 >> 64n);

    let h128 = (m128 & MASK_64) * PRIME64_2;

    h128 += ((m128 >> 64n) * PRIME64_2) << 64n;
    h128 &= MASK_128;

    return avalanche(h128 & MASK_64) | (avalanche(h128 >> 64n) << 64n);
};

const len0to16_128b = (data: Buffer, seed: bigint): bigint => {
    const len = data.byteLength;

    if (len > 8) {
        return len9to16_128b(data, KKEY, seed);
    }

    if (len >= 4) {
        return len4to8_128b(data, KKEY, seed);
    }

    if (len > 0) {
        return len1to3_128b(data, KKEY, seed);
    }

    return avalanche64(seed ^ KKEY.readBigUInt64LE(64) ^ KKEY.readBigUInt64LE(72))
        | (avalanche64(seed ^ KKEY.readBigUInt64LE(80) ^ KKEY.readBigUInt64LE(88)) << 64n);
};

const len17to128_128b = (data: Buffer, secret: Buffer, seed: bigint): bigint => {
    let acc = (BigInt(data.byteLength) * PRIME64_1) & MASK_64;
    let i = BigInt(data.byteLength - 1) / 32n;

    while (i >= 0n) {
        const ni = Number(i);

        acc = mix32B(acc, getView(data, 16 * ni), getView(data, data.byteLength - 16 * (ni + 1)), getView(secret, 32 * ni), seed);
        i--;
    }

    let h128l = (acc + (acc >> 64n)) & MASK_64;

    h128l = avalanche(h128l);

    let h128h = ((acc & MASK_64) * PRIME64_1)
        + ((acc >> 64n) * PRIME64_4)
        + (((BigInt(data.byteLength) - seed) & MASK_64) * PRIME64_2);

    h128h &= MASK_64;
    h128h = inv64(avalanche(h128h));

    return h128l | (h128h << 64n);
};

const len129to240_128b = (data: Buffer, secret: Buffer, seed: bigint): bigint => {
    let acc = (BigInt(data.byteLength) * PRIME64_1) & MASK_64;

    for (let i = 32; i < 160; i += 32) {
        acc = mix32B(acc, getView(data, i - 32), getView(data, i - 16), getView(secret, i - 32), seed);
    }

    acc = avalanche(acc & MASK_64) | (avalanche(acc >> 64n) << 64n);

    for (let i = 160; i <= data.byteLength; i += 32) {
        acc = mix32B(acc, getView(data, i - 32), getView(data, i - 16), getView(secret, 3 + i - 160), seed);
    }

    acc = mix32B(acc, getView(data, data.byteLength - 16), getView(data, data.byteLength - 32), getView(secret, 136 - 17 - 16), inv64(seed));

    let h128l = (acc + (acc >> 64n)) & MASK_64;

    h128l = avalanche(h128l);

    let h128h = ((acc & MASK_64) * PRIME64_1)
        + ((acc >> 64n) * PRIME64_4)
        + (((BigInt(data.byteLength) - seed) & MASK_64) * PRIME64_2);

    h128h &= MASK_64;
    h128h = inv64(avalanche(h128h));

    return h128l | (h128h << 64n);
};

/**
 * Computes xxh3-128 hash of a Buffer.
 * Ported from xxh3-ts (BSD-2-Clause, https://github.com/i404788/xxh3-ts).
 */
const xxh3_128 = (data: Buffer, seed = 0n): bigint => {
    const len = data.byteLength;

    if (len <= 16) {
        return len0to16_128b(data, seed);
    }

    if (len <= 128) {
        return len17to128_128b(data, KKEY, seed);
    }

    if (len <= 240) {
        return len129to240_128b(data, KKEY, seed);
    }

    // For seeded long inputs the reference algorithm derives a per-seed custom
    // secret; seed 0 uses the default secret (bit-exact with the native addon).
    return hashLong128b(data, seed === 0n ? KKEY : initCustomSecret(seed));
};

// ─── Public API ─────────────────────────────────────────────────────────────

/* eslint-enable no-bitwise, no-param-reassign, @typescript-eslint/no-shadow, sonarjs/cognitive-complexity */

/**
 * Converts a 128-bit BigInt to a 32-character hex string (big-endian),
 * matching the Rust `hex::encode(h.to_be_bytes())` format.
 */
const bigintToHex = (value: bigint): string => {
    const hi = (value >> 64n) & MASK_64;
    const lo = value & MASK_64;

    return hi.toString(16).padStart(16, "0") + lo.toString(16).padStart(16, "0");
};

/**
 * Hashes a value using xxh3-128 and returns a 32-character lowercase hex string.
 *
 * Accepts a `string` (encoded as UTF-8, matching the native `hashString`) or a
 * `Buffer`. With `seed = 0n` (the default) the output is bit-exact with the
 * native Rust addon.
 *
 * @param data The value to hash. Strings are UTF-8 encoded.
 * @param seed Optional 64-bit seed. Defaults to `0n`. Non-zero seeds change the
 *   hash for every length class, including inputs > 240 bytes (a per-seed custom
 *   secret is derived). The native addon does not expose seeded hashing, so
 *   seeded output cannot be cross-checked against it.
 */
const xxh3Hash = (data: string | Buffer, seed = 0n): string =>
    bigintToHex(xxh3_128(typeof data === "string" ? Buffer.from(data) : data, seed));

/**
 * Incremental xxh3-128 hasher that accumulates data and produces a final hash.
 *
 * xxh3 does not support true streaming, so chunks are buffered and hashed as a
 * single concatenated buffer at `digest()` time.
 *
 * Semantics differ from `node:crypto` hashers: the instance is reusable. After
 * `digest()` you may continue to `update()` and call `digest()` again (the new
 * digest covers all chunks, old and new), or call `reset()` to clear the
 * accumulated chunks and seed and start over.
 */
class Xxh3Hasher {
    readonly #chunks: Buffer[] = [];

    #seed: bigint;

    public constructor(seed = 0n) {
        this.#seed = seed;
    }

    /** Appends data to the buffer. Strings are UTF-8 encoded. Chainable. */
    public update(data: string | Buffer): this {
        this.#chunks.push(typeof data === "string" ? Buffer.from(data) : data);

        return this;
    }

    /**
     * Returns the xxh3-128 hash of all data fed so far as a 32-character hex
     * string. Non-terminal: the hasher remains usable afterwards.
     */
    public digest(): string {
        return xxh3Hash(Buffer.concat(this.#chunks), this.#seed);
    }

    /**
     * Clears all accumulated chunks so the hasher can be reused from scratch.
     * Optionally sets a new seed; omitting it keeps the current seed. Chainable.
     */
    public reset(seed?: bigint): this {
        this.#chunks.length = 0;

        if (seed !== undefined) {
            this.#seed = seed;
        }

        return this;
    }
}

/**
 * Creates a new incremental xxh3-128 hasher.
 *
 * @param seed Optional 64-bit seed forwarded to {@link xxh3Hash}. Defaults to `0n`.
 */
const createXxh3Hasher = (seed = 0n): Xxh3Hasher => new Xxh3Hasher(seed);

export type { Xxh3Hasher };
export { createXxh3Hasher, xxh3Hash };
