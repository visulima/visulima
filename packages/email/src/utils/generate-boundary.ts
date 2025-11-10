import { randomBytes } from "node:crypto";

/**
 * Generate boundary string for multipart emails
 * Works across Node.js, Deno, Bun, and Workers
 */
export const generateBoundary = (): string => `----_=_NextPart_${randomBytes(16).toString("hex")}`;
