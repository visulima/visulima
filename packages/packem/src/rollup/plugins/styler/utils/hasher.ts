import { createHash } from "node:crypto";

export default (data: string): string => createHash("sha256").update(data).digest("hex");
