import File from "./file";
import type { UploadEventType } from "./types";

const getFileStatus = (file: File): UploadEventType => (file.bytesWritten === file.size ? "completed" : (file.createdAt ? "part" : "created"));

export default getFileStatus;
