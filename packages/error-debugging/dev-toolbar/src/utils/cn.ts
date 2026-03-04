import type { ClassValue } from "clsx";
// eslint-disable-next-line import/no-extraneous-dependencies
import { clsx } from "clsx";

/**
 * Merges class values using clsx.
 * @param inputs Class values to merge.
 * @returns Merged class string.
 */
const cn = (...inputs: ClassValue[]): string => clsx(inputs);

export default cn;
