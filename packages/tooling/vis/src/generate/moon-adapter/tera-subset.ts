/**
 * Tera-subset renderer for moon-format template content.
 *
 * Supported constructs (intersection of moon's most-used features):
 *   - `{{ var }}` and `{{ var | filter }}` and `{{ var | filter(arg) }}`
 *     with chained filters: `{{ var | snake_case | upper_case }}`
 *   - `{% if expr %} ... {% else %} ... {% endif %}`
 *     where `expr` is `var`, `not var`, `var == "lit"`, `var != "lit"`
 *   - `{% for x in collection %} ... {% endfor %}`
 *     where `collection` is a variable holding an array
 *   - `{% include "name" %}` — pulls the rendered output of a partial
 *
 * Explicitly UNSUPPORTED, with a clear `file:line` error message:
 *   - `{% set x = ... %}`
 *   - `{% extends "..." %}`
 *   - `{% block ... %}` / `{% endblock %}`
 *   - `{% macro ... %}` / `{% endmacro %}`
 *   - Custom whitespace control (`{%- -%}`)
 *
 * The parser is a single-pass tokenizer feeding a tree-walking
 * evaluator. Errors carry the original 1-based line number for the
 * source file, threaded through from the moon adapter via `filename`.
 */

import { applyFilter } from "./filters";
import { splitCommaOutsideQuotes } from "./util";

type QuoteChar = "\"" | "'";

type Token = { line: number; type: "text"; value: string } | { line: number; type: "expr"; value: string } | { line: number; type: "stmt"; value: string };

const TAG_PATTERN = /\{\{-?(.+?)-?\}\}|\{%-?(.+?)-?%\}/gs;

const tokenize = (source: string): Token[] => {
    const tokens: Token[] = [];
    let lastIndex = 0;
    let line = 1;

    const advanceLine = (text: string): void => {
        for (const character of text) {
            if (character === "\n") {
                line += 1;
            }
        }
    };

    for (const match of source.matchAll(TAG_PATTERN)) {
        const start = match.index ?? 0;

        if (start > lastIndex) {
            const text = source.slice(lastIndex, start);

            tokens.push({ line, type: "text", value: text });
            advanceLine(text);
        }

        const startLine = line;
        const full = match[0];

        if (full.startsWith("{{")) {
            tokens.push({ line: startLine, type: "expr", value: (match[1] ?? "").trim() });
        } else {
            tokens.push({ line: startLine, type: "stmt", value: (match[2] ?? "").trim() });
        }

        advanceLine(full);
        lastIndex = start + full.length;
    }

    if (lastIndex < source.length) {
        const text = source.slice(lastIndex);

        tokens.push({ line, type: "text", value: text });
    }

    return tokens;
};

type Node
    = | { type: "text"; value: string }
        | { expression: string; line: number; type: "expr" }
        | { alternate?: Node[]; condition: string; consequent: Node[]; line: number; type: "if" }
        | { binding: string; body: Node[]; collection: string; line: number; type: "for" }
        | { line: number; name: string; type: "include" };

const UNSUPPORTED_KEYWORDS = new Set(["block", "endblock", "endfilter", "endmacro", "extends", "filter", "import", "macro", "set"]);

const parse = (tokens: Token[], filename: string): Node[] => {
    let cursor = 0;

    const error = (line: number, message: string): never => {
        throw new Error(`${filename}:${line}: ${message}`);
    };

    const parseBlock = (terminators: string[]): Node[] => {
        const nodes: Node[] = [];

        while (cursor < tokens.length) {
            const token = tokens[cursor]!;

            if (token.type === "text") {
                nodes.push({ type: "text", value: token.value });
                cursor += 1;
                continue;
            }

            if (token.type === "expr") {
                nodes.push({ expression: token.value, line: token.line, type: "expr" });
                cursor += 1;
                continue;
            }

            // stmt
            const head = token.value.split(/\s+/)[0] ?? "";

            if (terminators.includes(head)) {
                return nodes;
            }

            if (UNSUPPORTED_KEYWORDS.has(head)) {
                error(
                    token.line,
                    `Tera feature "{% ${head} %}" is not supported. Supported: if/else/endif, for/endfor, include. `
                    + "Rewrite the template to avoid macros, set, extends, block, and import.",
                );
            }

            if (head === "if") {
                cursor += 1;
                const condition = token.value.slice(2).trim();
                const consequent = parseBlock(["else", "endif"]);
                let alternate: Node[] | undefined;

                if (cursor < tokens.length && tokens[cursor]!.type === "stmt" && tokens[cursor]!.value.split(/\s+/)[0] === "else") {
                    cursor += 1;
                    alternate = parseBlock(["endif"]);
                }

                if (cursor >= tokens.length || tokens[cursor]!.type !== "stmt" || tokens[cursor]!.value.split(/\s+/)[0] !== "endif") {
                    error(token.line, "Unterminated {% if %} — missing {% endif %}");
                }

                cursor += 1; // consume endif
                nodes.push({ alternate, condition, consequent, line: token.line, type: "if" });
                continue;
            }

            if (head === "for") {
                cursor += 1;
                const rest = token.value.slice(3).trim();
                const inIndex = rest.indexOf(" in ");

                if (inIndex === -1) {
                    error(token.line, "Malformed {% for %} — expected `for <name> in <collection>`");
                }

                const binding = rest.slice(0, inIndex).trim();
                const collection = rest.slice(inIndex + 4).trim();

                if (!binding || !collection) {
                    error(token.line, "Malformed {% for %} — missing binding or collection");
                }

                const body = parseBlock(["endfor"]);

                if (cursor >= tokens.length || tokens[cursor]!.type !== "stmt" || tokens[cursor]!.value.split(/\s+/)[0] !== "endfor") {
                    error(token.line, "Unterminated {% for %} — missing {% endfor %}");
                }

                cursor += 1;
                nodes.push({ binding, body, collection, line: token.line, type: "for" });
                continue;
            }

            if (head === "include") {
                cursor += 1;
                const argument = token.value.slice(7).trim();
                const stripped = stripQuotes(argument);

                if (stripped === undefined) {
                    error(token.line, "Malformed {% include %} — expected a quoted partial name");
                }

                nodes.push({ line: token.line, name: stripped!, type: "include" });
                continue;
            }

            error(token.line, `Unknown tag "{% ${head} %}". Supported: if, for, include.`);
        }

        return nodes;
    };

    return parseBlock([]);
};

const stripQuotes = (input: string): string | undefined => {
    if ((input.startsWith("\"") && input.endsWith("\"")) || (input.startsWith("'") && input.endsWith("'"))) {
        return input.slice(1, -1);
    }

    return undefined;
};

const stringify = (value: unknown): string => {
    if (value == null) {
        return "";
    }

    if (typeof value === "boolean" || typeof value === "number") {
        return String(value);
    }

    if (typeof value === "string") {
        return value;
    }

    return JSON.stringify(value);
};

const isTruthy = (value: unknown): boolean => {
    if (value === null || value === undefined || value === false || value === 0 || value === "") {
        return false;
    }

    if (Array.isArray(value)) {
        return value.length > 0;
    }

    return true;
};

/**
 * Look up a dotted-path identifier in `scope`. When `strict` is true
 * (the default — used by `{{ var }}` renders), a missing root
 * identifier throws so template authors see typos instead of silently
 * empty output. When `strict` is false (used by `{% if var %}`
 * conditions), missing identifiers return `undefined` so they evaluate
 * as falsy — matching moon/Tera's condition semantics.
 */
const lookupVariable = (path: string, scope: Record<string, unknown>, line: number, filename: string, strict: boolean = true): unknown => {
    const segments = path.split(".");

    if (strict && segments.length > 0 && !Object.hasOwn(scope, segments[0]!)) {
        throw new Error(`${filename}:${line}: Variable "${path}" is not defined`);
    }

    let value: unknown = scope;

    for (const segment of segments) {
        if (value === null || value === undefined) {
            return undefined;
        }

        if (typeof value !== "object") {
            throw new TypeError(`${filename}:${line}: Cannot read "${segment}" on non-object value`);
        }

        value = (value as Record<string, unknown>)[segment];
    }

    return value;
};

const splitFilterPipe = (expression: string): string[] => {
    const parts: string[] = [];
    let depth = 0;
    let start = 0;
    let inQuote: QuoteChar | undefined;

    for (let index = 0; index < expression.length; index += 1) {
        const character = expression[index]!;

        if (inQuote) {
            if (character === inQuote) {
                inQuote = undefined;
            }

            continue;
        }

        if (character === "\"" || character === "'") {
            inQuote = character;
            continue;
        }

        if (character === "(") {
            depth += 1;
        } else if (character === ")") {
            depth -= 1;
        } else if (character === "|" && depth === 0) {
            parts.push(expression.slice(start, index));
            start = index + 1;
        }
    }

    parts.push(expression.slice(start));

    return parts;
};

const parseFilterCall = (chunk: string): { args: string[]; name: string } => {
    const trimmed = chunk.trim();
    const openParen = trimmed.indexOf("(");

    if (openParen === -1) {
        return { args: [], name: trimmed };
    }

    if (!trimmed.endsWith(")")) {
        throw new Error(`Filter call "${chunk}" missing closing ")"`);
    }

    const name = trimmed.slice(0, openParen).trim();
    const argsRaw = trimmed.slice(openParen + 1, -1).trim();

    if (!argsRaw) {
        return { args: [], name };
    }

    return { args: splitCommaOutsideQuotes(argsRaw).map((s) => s.trim()), name };
};

const evaluatePrimary = (token: string, scope: Record<string, unknown>, line: number, filename: string, strict: boolean = true): unknown => {
    const trimmed = token.trim();

    if (trimmed === "true") {
        return true;
    }

    if (trimmed === "false") {
        return false;
    }

    if (trimmed === "null" || trimmed === "none") {
        return null;
    }

    const stripped = stripQuotes(trimmed);

    if (stripped !== undefined) {
        return stripped;
    }

    if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
        return Number(trimmed);
    }

    return lookupVariable(trimmed, scope, line, filename, strict);
};

/**
 * Evaluate an expression (variable lookup + optional filter pipeline).
 * `strict` defaults to true — missing variables throw. Callers inside
 * conditions (`{% if var %}`) pass `strict=false` so undefined is
 * treated as falsy per Tera semantics.
 */
const evaluateExpression = (expression: string, scope: Record<string, unknown>, line: number, filename: string, strict: boolean = true): unknown => {
    const segments = splitFilterPipe(expression);
    const head = segments[0]!.trim();

    let value = evaluatePrimary(head, scope, line, filename, strict);

    for (let index = 1; index < segments.length; index += 1) {
        const filterCall = segments[index]!.trim();
        const { args, name } = parseFilterCall(filterCall);
        const resolvedArgs = args.map((argument) => evaluatePrimary(argument, scope, line, filename, strict));

        try {
            value = applyFilter(name, value, resolvedArgs);
        } catch (error_) {
            const message = error_ instanceof Error ? error_.message : String(error_);

            throw new Error(`${filename}:${line}: ${message}`, { cause: error_ });
        }
    }

    return value;
};

const findOperatorOutsideQuotes = (input: string, operator: string): number => {
    let inQuote: QuoteChar | undefined;
    let depth = 0;

    for (let index = 0; index <= input.length - operator.length; index += 1) {
        const character = input[index]!;

        if (inQuote) {
            if (character === inQuote) {
                inQuote = undefined;
            }

            continue;
        }

        if (character === "\"" || character === "'") {
            inQuote = character;
            continue;
        }

        if (character === "(") {
            depth += 1;
            continue;
        }

        if (character === ")") {
            depth -= 1;
            continue;
        }

        if (depth !== 0) {
            continue;
        }

        if (input.slice(index, index + operator.length) === operator) {
            return index;
        }
    }

    return -1;
};

/**
 * Split a condition string on the widest-reaching logical operator at
 * the top level (outside quotes and parentheses). `splitLogical`
 * returns every position so callers can fold left-to-right without
 * re-scanning.
 */
const splitLogical = (input: string, keyword: " and " | " or "): string[] => {
    const parts: string[] = [];
    let start = 0;
    let index = 0;

    while (index <= input.length - keyword.length) {
        const at = findOperatorOutsideQuotes(input.slice(index), keyword);

        if (at === -1) {
            break;
        }

        parts.push(input.slice(start, index + at));
        index += at + keyword.length;
        start = index;
    }

    parts.push(input.slice(start));

    return parts;
};

/**
 * Recursive-descent condition evaluator with precedence:
 *   `or` (lowest) → `and` → `not` → comparison (`==` / `!=`) → primary.
 * Parentheses override precedence.
 *
 * Exported so the moon adapter can reuse the same grammar on
 * frontmatter `if:` / `skip:` strings.
 */
export const evaluateConditionExpression = (condition: string, scope: Record<string, unknown>, filename: string, line: number): boolean => {
    const trimmed = condition.trim();

    if (trimmed === "") {
        return false;
    }

    // Strip a single fully-surrounding parenthesis pair.
    if (trimmed.startsWith("(") && trimmed.endsWith(")") && matchingParen(trimmed) === trimmed.length - 1) {
        return evaluateConditionExpression(trimmed.slice(1, -1), scope, filename, line);
    }

    const orParts = splitLogical(trimmed, " or ");

    if (orParts.length > 1) {
        return orParts.some((part) => evaluateConditionExpression(part, scope, filename, line));
    }

    const andParts = splitLogical(trimmed, " and ");

    if (andParts.length > 1) {
        return andParts.every((part) => evaluateConditionExpression(part, scope, filename, line));
    }

    if (trimmed.startsWith("not ")) {
        return !evaluateConditionExpression(trimmed.slice(4), scope, filename, line);
    }

    for (const operator of ["==", "!="]) {
        const index = findOperatorOutsideQuotes(trimmed, operator);

        if (index !== -1) {
            const left = evaluatePrimary(trimmed.slice(0, index), scope, line, filename, false);
            const right = evaluatePrimary(trimmed.slice(index + operator.length), scope, line, filename, false);
            const equal = left === right;

            return operator === "==" ? equal : !equal;
        }
    }

    return isTruthy(evaluateExpression(trimmed, scope, line, filename, false));
};

/**
 * Find the index of the `)` that matches the opening `(` at position 0.
 * Returns -1 when the input doesn't start with `(` or the pair is
 * unbalanced. Quotes are respected.
 */
const matchingParen = (input: string): number => {
    if (input[0] !== "(") {
        return -1;
    }

    let depth = 0;
    let inQuote: QuoteChar | undefined;
    let index = -1;

    for (const character of input) {
        index += 1;

        if (inQuote) {
            if (character === inQuote) {
                inQuote = undefined;
            }

            continue;
        }

        if (character === "\"" || character === "'") {
            inQuote = character;
            continue;
        }

        if (character === "(") {
            depth += 1;
        } else if (character === ")") {
            depth -= 1;

            if (depth === 0) {
                return index;
            }
        }
    }

    return -1;
};

interface RenderOptions {
    /** Source filename — used in error messages. */
    filename: string;

    /**
     * Internal: set of partial names currently on the include stack.
     * Used to detect cycles — if an include re-enters a partial that's
     * already resolving, we throw instead of stack-overflowing.
     */
    includeStack?: Set<string>;
    /** Map of partial name → already-resolved AST. */
    partials?: Map<string, Node[]>;
    /** Variable scope (built-in vars merged with user options). */
    scope: Record<string, unknown>;
}

const renderNodes = (nodes: Node[], options: RenderOptions): string => {
    let output = "";

    for (const node of nodes) {
        if (node.type === "text") {
            output += node.value;
            continue;
        }

        if (node.type === "expr") {
            output += stringify(evaluateExpression(node.expression, options.scope, node.line, options.filename));
            continue;
        }

        if (node.type === "if") {
            const branch = evaluateConditionExpression(node.condition, options.scope, options.filename, node.line) ? node.consequent : (node.alternate ?? []);

            output += renderNodes(branch, options);
            continue;
        }

        if (node.type === "for") {
            // `{% for x in items %}` where `items` is absent is
            // equivalent to an empty loop — don't throw.
            const collection = lookupVariable(node.collection, options.scope, node.line, options.filename, false);

            if (collection === undefined || collection === null) {
                continue;
            }

            if (!Array.isArray(collection)) {
                throw new TypeError(`${options.filename}:${node.line}: {% for %} expected an array, got ${typeof collection}`);
            }

            for (const item of collection) {
                const childScope = { ...options.scope, [node.binding]: item };

                output += renderNodes(node.body, { ...options, scope: childScope });
            }

            continue;
        }

        if (node.type === "include") {
            const ast = options.partials?.get(node.name);

            if (!ast) {
                throw new Error(
                    `${options.filename}:${node.line}: Partial "${node.name}" not found. Available: ${[...(options.partials?.keys() ?? [])].join(", ") || "(none)"}`,
                );
            }

            const stack = options.includeStack ?? new Set<string>();

            if (stack.has(node.name)) {
                const chain = [...stack, node.name].join(" → ");

                throw new Error(`${options.filename}:${node.line}: Circular partial include detected: ${chain}`);
            }

            stack.add(node.name);

            try {
                output += renderNodes(ast, { ...options, filename: `<partial:${node.name}>`, includeStack: stack });
            } finally {
                stack.delete(node.name);
            }
        }
    }

    return output;
};

/**
 * Parse a template source into an AST. Used by the moon adapter to
 * pre-parse partials once and reuse them across files.
 */
export const parseTemplate = (source: string, filename: string): Node[] => parse(tokenize(source), filename);

/**
 * Render a parsed AST with the given scope.
 */
export const renderAst = (nodes: Node[], options: RenderOptions): string => renderNodes(nodes, options);

/**
 * Convenience: parse + render in one call. Prefer `parseTemplate` +
 * `renderAst` when a template is rendered repeatedly (e.g. in loops).
 */
export const renderTemplate = (source: string, options: RenderOptions): string => renderNodes(parse(tokenize(source), options.filename), options);

export type { Node };
