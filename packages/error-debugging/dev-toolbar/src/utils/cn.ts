import type { ClassValue } from "clsx";
// eslint-disable-next-line import/no-extraneous-dependencies
import { clsx } from "clsx";
// eslint-disable-next-line import/no-extraneous-dependencies
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind CSS classes using clsx and tailwind-merge.
 * @param inputs Class values to merge.
 * @returns Merged class string.
 */
const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));

export default cn;
