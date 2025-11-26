import { randomBytes } from "node:crypto";

/**
 * Generate boundary string for multipart emails
 * Works across Node.js, Deno, Bun, and Workers
 * @returns A unique boundary string for MIME multipart messages
 */
const generateBoundary = (): string => `----_=_NextPart_${randomBytes(16).toString("hex")}`;

export default generateBoundary;
