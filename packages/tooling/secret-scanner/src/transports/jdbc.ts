import type { TransportContext, TransportHostResolver, TransportValidator } from "./context";
import { validateMongoDB } from "./mongodb";
import { validateMySQL } from "./mysql";
import { validatePostgres } from "./postgres";
import { hostFromUri } from "./runtime";

const JDBC_URL_PATTERN = /^jdbc:([a-zA-Z][a-zA-Z0-9+.-]*):(\/\/.+)$/;

// Map a JDBC subprotocol to the URI scheme the corresponding driver parses.
const JDBC_SCHEME_BY_SUBPROTOCOL: Record<string, string> = {
    mariadb: "mysql",
    mongodb: "mongodb",
    mysql: "mysql",
    postgres: "postgres",
    postgresql: "postgres",
};

/**
 * Resolve the host a JDBC URL would connect to for the allowlist gate. Parses
 * `jdbc:{scheme}://…`, rewrites to the driver scheme, and reads `URL.host`.
 * Returns `undefined` for JDBC flavours we don't dispatch (oracle, h2, …) or an
 * unparseable URL — fail-closed when an allowlist is active.
 */
export const resolveJdbcHosts: TransportHostResolver = ({ secret }) => {
    const match = JDBC_URL_PATTERN.exec(secret.trim());

    if (!match) {
        return undefined;
    }

    const scheme = JDBC_SCHEME_BY_SUBPROTOCOL[(match[1] ?? "").toLowerCase()];

    if (scheme === undefined) {
        return undefined;
    }

    const host = hostFromUri(`${scheme}:${match[2] ?? ""}`);

    return host === undefined ? undefined : [host];
};

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
