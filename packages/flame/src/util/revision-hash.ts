import { createHash } from "node:crypto";  

const revisionHash = (data: string): string => {  
  if (typeof data !== "string") {  
    throw new TypeError("revisionHash: input must be a string");  
  }  

  // Use SHA-256 for better collision resistance; take 16 hex chars (64 bits)  
  return createHash("sha256")  
    .update(data, "utf8")  
    .digest("hex")  
    .slice(0, 16);  
};  

export default revisionHash;
