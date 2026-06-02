import type { InboundEmail } from "./types";

/**
 * Reply/forward subject prefixes stripped during fallback threading (EN/DE/FR/ES/NL/SV).
 */
const SUBJECT_PREFIXES = ["re", "fwd", "fw", "aw", "wg", "sv", "vs"];

/**
 * Minimal union-find for grouping connected Message-IDs.
 */
class UnionFind {
    private readonly parent = new Map<string, string>();

    public find(key: string): string {
        if (!this.parent.has(key)) {
            this.parent.set(key, key);

            return key;
        }

        let root = key;
        let next = this.parent.get(root);

        while (next !== undefined && next !== root) {
            root = next;
            next = this.parent.get(root);
        }

        this.parent.set(key, root);

        return root;
    }

    public union(a: string, b: string): void {
        const rootA = this.find(a);
        const rootB = this.find(b);

        if (rootA !== rootB) {
            this.parent.set(rootA, rootB);
        }
    }
}

/**
 * A group of inbound messages belonging to the same conversation.
 */
export interface EmailThread {
    /**
     * A stable identifier for the thread (the canonical root Message-ID, or a normalized subject).
     */
    id: string;

    /**
     * The messages in the thread. Order reflects input order (callers can sort by date if needed).
     */
    messages: InboundEmail[];
}

/**
 * Strips angle brackets and surrounding whitespace from a Message-ID for consistent matching.
 * @param id A raw Message-ID, optionally wrapped in angle brackets.
 * @returns The bare Message-ID.
 */
export const normalizeMessageId = (id: string): string => id.replaceAll(/[<>]/g, "").trim();

/**
 * Normalizes a subject for fallback threading: strips leading `Re:`/`Fwd:`/`Aw:`/`Wg:` prefixes and
 * collapses whitespace. Uses a linear loop rather than a backtracking regex.
 * @param subject The raw subject.
 * @returns The normalized subject key.
 */
export const normalizeSubject = (subject: string): string => {
    let value = subject.trim();
    let stripped = true;

    while (stripped) {
        stripped = false;

        for (const prefix of SUBJECT_PREFIXES) {
            const lower = value.toLowerCase();

            if (!lower.startsWith(prefix)) {
                continue;
            }

            const rest = value.slice(prefix.length).trimStart();

            if (rest.startsWith(":")) {
                value = rest.slice(1).trimStart();
                stripped = true;
                break;
            }
        }
    }

    return value.replaceAll(/\s+/g, " ").trim().toLowerCase();
};

/**
 * Groups inbound messages into conversation threads.
 *
 * Messages are linked via their `In-Reply-To` and `References` Message-IDs (RFC 5322 threading).
 * Messages that share no references but have an identical normalized subject are stitched together as
 * a fallback, matching how mail clients group conversations.
 * @param messages The inbound messages to thread.
 * @returns The detected threads. See {@link EmailThread}.
 */
export const stitchThreads = (messages: InboundEmail[]): EmailThread[] => {
    const unionFind = new UnionFind();
    const subjectRoots = new Map<string, string>();

    const keyFor = (message: InboundEmail, index: number): string => {
        if (message.messageId) {
            return normalizeMessageId(message.messageId);
        }

        return `__index_${String(index)}`;
    };

    messages.forEach((message, index) => {
        const key = keyFor(message, index);

        const related = [message.inReplyTo, ...message.references].filter((value): value is string => value !== undefined);

        for (const reference of related) {
            unionFind.union(key, normalizeMessageId(reference));
        }

        // Subject-based fallback only when the message has no explicit threading links.
        if (related.length === 0 && message.subject) {
            const subjectKey = normalizeSubject(message.subject);

            if (subjectKey) {
                const existing = subjectRoots.get(subjectKey);

                if (existing) {
                    unionFind.union(key, existing);
                } else {
                    subjectRoots.set(subjectKey, key);
                }
            }
        }
    });

    const groups = new Map<string, InboundEmail[]>();

    messages.forEach((message, index) => {
        const root = unionFind.find(keyFor(message, index));
        const bucket = groups.get(root);

        if (bucket) {
            bucket.push(message);
        } else {
            groups.set(root, [message]);
        }
    });

    return [...groups.entries()].map(([id, threadMessages]) => {
        return { id, messages: threadMessages };
    });
};
