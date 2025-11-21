import { createNextjsHandler } from "@visulima/storage/handler/http/nextjs";
import { storage } from "../../../../lib/storage";

const handler = createNextjsHandler({ storage, type: "rest" });

export const POST = handler;
export const GET = handler;
export const DELETE = handler;
export const OPTIONS = handler;

