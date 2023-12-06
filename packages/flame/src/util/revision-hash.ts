import { createHash } from "node:crypto";

const revisionHash = (data: string) => createHash("md5").update(data).digest("hex").slice(0, 10);

export default revisionHash;
