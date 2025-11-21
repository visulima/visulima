import { createNextjsHandler } from "@visulima/storage/handler/http/nextjs";
import { storage } from "../../../../../lib/storage";

const handler = createNextjsHandler({ storage, type: "rest" });

export const PUT = handler;
export const PATCH = handler;
export const GET = handler;
export const HEAD = handler;
export const DELETE = handler;
export const OPTIONS = handler;

