import type { StarPattern } from "../types";

const isPatternMatch = ({ prefix, suffix }: StarPattern, candidate: string): boolean => candidate.startsWith(prefix) && candidate.endsWith(suffix);

export default isPatternMatch;
