import { createHandler } from "@visulima/storage/handler/http/nextjs";
import { storage } from "../../../../lib/storage";

const handler = createHandler({ storage, type: "multipart" });

export const POST = handler;
export const DELETE = handler;
export const GET = handler;
export const OPTIONS = handler;

