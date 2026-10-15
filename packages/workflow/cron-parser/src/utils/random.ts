/* eslint-disable func-style, jsdoc/check-param-names, jsdoc/match-description, no-bitwise, no-param-reassign, no-plusplus, unicorn/prefer-code-point -- ported from the reference implementation, whose behaviour its tests pin; these style rules stay relaxed so the code remains easy to compare with the original (the search engine in schedule.ts, zone.ts and cron-expression.ts has no such exceptions) */

/**
 * A type representing a Pseudorandom Number Generator, similar to Math.random()
 */
type PRNG = () => number;

/**
 * Computes a numeric hash from a given string
 * @param str A value to hash
 * @returns A numeric hash computed from the given value
 */
function xfnv1a(string_: string) {
    let h = 2_166_136_261 >>> 0;

    for (let i = 0; i < string_.length; i++) {
        h ^= string_.charCodeAt(i);
        h = Math.imul(h, 16_777_619);
    }

    return () => h >>> 0;
}

/**
 * Initialize a new PRNG using a given seed
 * @param seed The seed used to initialize the PRNG
 * @returns A random number generator
 */
function mulberry32(seed: number) {
    return () => {
        seed += 0x6d_2b_79_f5;

        let t = seed;

        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

        return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
    };
}

/**
 * Generates a PRNG using a given seed. When not provided, the seed is randomly generated
 * @param str A string to derive the seed from
 * @returns A random number generator correctly seeded
 */
function seededRandom(string_?: string): PRNG {
    // eslint-disable-next-line sonarjs/pseudo-random -- an unseeded hash only needs to vary, not to be unpredictable
    const seed = string_ ? xfnv1a(string_)() : Math.floor(Math.random() * 10_000_000_000);

    return mulberry32(seed);
}

export { seededRandom };
export type { PRNG };
