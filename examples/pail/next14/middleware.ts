import { createPail } from "@visulima/pail";
import { PrettyReporter } from "@visulima/pail/reporter/pretty";
import { NextResponse } from "next/server";

const pail = createPail({
    reporters: [new PrettyReporter()],
})

export async function middleware(): Promise<NextResponse> {
    const response = NextResponse.next();

    pail.info("\x1b[36m%s\x1b[0m", "Middleware log can use colour"); //cyan
    pail.info("pail colors works! :)");

    return response;
}
