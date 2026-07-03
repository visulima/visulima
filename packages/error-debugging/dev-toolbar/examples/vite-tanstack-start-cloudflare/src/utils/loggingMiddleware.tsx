import { createMiddleware } from "@tanstack/react-start";

export const logMiddleware = createMiddleware({ type: "function" })
    .middleware([
        createMiddleware({ type: "function" })
            .client(async (context) => {
                const clientTime = new Date();

                return await context.next({
                    context: {
                        clientTime,
                    },
                    sendContext: {
                        clientTime,
                    },
                });
            })
            .server(async (context) => {
                const serverTime = new Date();

                return await context.next({
                    sendContext: {
                        durationToServer: serverTime.getTime() - context.context.clientTime.getTime(),
                        serverTime,
                    },
                });
            }),
    ])
    .client(async (options) => {
        const result = await options.next();

        const now = new Date();

        console.log("Client Req/Res:", {
            duration: result.context.clientTime.getTime() - now.getTime(),
            durationFromServer: now.getTime() - result.context.serverTime.getTime(),
            durationToServer: result.context.durationToServer,
        });

        return result;
    });
