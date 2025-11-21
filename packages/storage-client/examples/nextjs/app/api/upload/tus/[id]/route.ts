import { createNextjsHandler } from "@visulima/storage/handler/http/nextjs";
import { storage } from "../../../../../lib/storage";

const handler = createNextjsHandler({ storage, type: "tus" });

export const PATCH = handler;
export const HEAD = handler;
export const DELETE = handler;
export const OPTIONS = handler;

