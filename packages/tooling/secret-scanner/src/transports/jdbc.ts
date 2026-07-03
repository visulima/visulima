import type { TransportContext, TransportValidator } from "./context";
import { validateMongoDB } from "./mongodb";
import { validateMySQL } from "./mysql";
import { validatePostgres } from "./postgres";

const JDBC_URL_PATTERN = /^jdbc:([a-zA-Z][a-zA-Z0-9+.-]*):(\/\/.+)$/;

/**
 * JDBC URL parser + dispatcher. `jdbc:mysql://…` normalises to `mysql://…`
 * and runs the MySQL validator; same for postgresql + mongodb. Other JDBC
 * flavours (oracle, sqlserver, h2, …) skip — no driver path shipped.
 */
export const validateJdbc: TransportValidator = async (context: TransportContext) => {
    const match = JDBC_URL_PATTERN.exec(context.secret.trim());

    if (!match) {
        return "skipped";
    }

    const subprotocol = (match[1] ?? "").toLowerCase();
    const rest = match[2] ?? "";

    if (subprotocol === "mysql" || subprotocol === "mariadb") {
        return validateMySQL({ ...context, secret: `mysql:${rest}` });
    }

    if (subprotocol === "postgresql" || subprotocol === "postgres") {
        return validatePostgres({ ...context, secret: `postgres:${rest}` });
    }

    if (subprotocol === "mongodb") {
        return validateMongoDB({ ...context, secret: `mongodb:${rest}` });
    }

    return "skipped";
};
