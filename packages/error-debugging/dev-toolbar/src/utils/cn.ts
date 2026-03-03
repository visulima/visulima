import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS classes with clsx and tailwind-merge
 * @param inputs Class values to merge
 * @returns Merged class string
 */
const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));

export default cn;
