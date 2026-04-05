/**
 * Random project name generator — produces friendly `adjective-noun` names
 * used as default project name suggestions in interactive mode.
 */

const ADJECTIVES = [
    "agile", "bold", "bright", "calm", "clever",
    "cool", "crisp", "daring", "eager", "fast",
    "fierce", "fresh", "gentle", "grand", "happy",
    "keen", "lively", "mighty", "nimble", "polite",
    "proud", "quiet", "rapid", "sharp", "sleek",
    "smart", "snappy", "steady", "swift", "vivid",
    "warm", "witty", "zen",
] as const;

const NOUNS = [
    "acorn", "arrow", "atlas", "beacon", "blade",
    "bolt", "bridge", "cedar", "cloud", "comet",
    "coral", "crest", "dawn", "delta", "ember",
    "falcon", "flare", "forge", "frost", "grove",
    "harbor", "heron", "jade", "lark", "maple",
    "orbit", "pearl", "pine", "pixel", "prism",
    "quartz", "raven", "ridge", "sage", "spark",
    "spruce", "stone", "tide", "vale", "willow",
] as const;

const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)] as T;

/**
 * Generate a random `adjective-noun` project name.
 *
 * @example
 * ```ts
 * randomName(); // "swift-ember"
 * randomName(); // "bold-prism"
 * ```
 */
export const randomName = (): string => `${pick(ADJECTIVES)}-${pick(NOUNS)}`;
