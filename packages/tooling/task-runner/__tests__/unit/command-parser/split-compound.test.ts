import { describe, expect, it } from "vitest";

import { splitCompoundCommand } from "../../../src/command-parser/split-compound";

describe(splitCompoundCommand, () => {
    // [input, expected segments, expected refusal reason (undefined = not refused)]
    const splitCases: [string, string[], string | undefined][] = [
        // Plain top-level chains
        ["a && b", ["a", "b"], undefined],
        ["build && lint && test", ["build", "lint", "test"], undefined],
        ["  npm run build   &&   npm run lint  ", ["npm run build", "npm run lint"], undefined],
        ["npm run build", ["npm run build"], undefined],
        ["", [""], undefined],

        // `&&` inside quotes or escaped is not a boundary
        ['echo "a && b" && c', ['echo "a && b"', "c"], undefined],
        ["echo 'x&&y'", ["echo 'x&&y'"], undefined],
        ["echo 'a && b' && c", ["echo 'a && b'", "c"], undefined],
        [String.raw`a \&\& b`, [String.raw`a \&\& b`], undefined],
        [String.raw`a \&\& b && c`, [String.raw`a \&\& b`, "c"], undefined],
        ['npm run build -- --flag="a && b"', ['npm run build -- --flag="a && b"'], undefined],
        ["npm run build -- --flag='a && b' && npm test", ["npm run build -- --flag='a && b'", "npm test"], undefined],

        // Pipes stay inside their segment
        ["a | b && c", ["a | b", "c"], undefined],
        ["a && b | c", ["a", "b | c"], undefined],

        // Redirections are kept, including fd duplication and &> redirects
        ["build > out.log 2>&1 && lint", ["build > out.log 2>&1", "lint"], undefined],
        ["build &> out.log && lint", ["build &> out.log", "lint"], undefined],

        // Words named like stateful commands are arguments, not commands
        ["echo cd && build", ["echo cd", "build"], undefined],
        ["node -e exec && build", ["node -e exec", "build"], undefined],
        ["npm run build -- FOO=bar && lint", ["npm run build -- FOO=bar", "lint"], undefined],

        // Unsupported: a top-level `;`, `||`, background `&`, newline
        ["a; b && c", ["a; b && c"], "`;` or newline"],
        ["a && b; c", ["a && b; c"], "`;` or newline"],
        ["a || b && c", ["a || b && c"], "`||`"],
        ["a && b || c", ["a && b || c"], "`||`"],
        ["a & b && c", ["a & b && c"], "background `&`"],
        ["a &&& b", ["a &&& b"], "background `&`"],
        ["a && b\nc", ["a && b\nc"], "`;` or newline"],

        // Unsupported: subshells, substitution, heredocs, comments, cmd escapes
        ["a && (b && c)", ["a && (b && c)"], "subshell `( … )`"],
        ["(a && b) && c", ["(a && b) && c"], "subshell `( … )`"],
        ["echo $(a && b)", ["echo $(a && b)"], "command substitution"],
        ["echo \"$(a && b)\" && c", ['echo "$(a && b)" && c'], "command substitution"],
        ["echo `a && b` && c", ["echo `a && b` && c"], "command substitution"],
        ["echo $'a' && c", ["echo $'a' && c"], "command substitution"],
        ["cat <<EOF && build", ["cat <<EOF && build"], "heredoc"],
        ["a && b # c && d", ["a && b # c && d"], "comment `#`"],
        ["a && b ^& c", ["a && b ^& c"], "cmd escape `^`"],

        // Unsupported: empty segments
        ["a &&", ["a &&"], "empty segment"],
        ["&& a", ["&& a"], "empty segment"],
        ["a && && b", ["a && && b"], "empty segment"],

        // Unsupported: stateful words at command or pipeline position
        ["cd app && build", ["cd app && build"], "`cd`"],
        ["build && cd app", ["build && cd app"], "`cd`"],
        ["export NODE_ENV=prod && build", ["export NODE_ENV=prod && build"], "`export`"],
        ["NODE_ENV=prod build && lint", ["NODE_ENV=prod build && lint"], "`NODE_ENV=` variable prefix"],
        ["build && A=1 B=2 lint", ["build && A=1 B=2 lint"], "`A=` variable prefix"],
        ["source env.sh && build", ["source env.sh && build"], "`source`"],
        [". ./env.sh && build", [". ./env.sh && build"], "`.`"],
        ["set -e && build", ["set -e && build"], "`set`"],
        ["trap 'rm -f x' EXIT && build", ["trap 'rm -f x' EXIT && build"], "`trap`"],
        ["exec build && lint", ["exec build && lint"], "`exec`"],
        ["a | cd x && b", ["a | cd x && b"], "`cd`"],
        ['"cd" app && build', ['"cd" app && build'], "`cd`"],

        // Unbalanced quotes cannot be split reliably
        ['echo "a && b', ['echo "a && b'], "unbalanced quote"],
        ["echo 'a && b", ["echo 'a && b"], "unbalanced quote"],

        // Windows-style quoting and paths
        [String.raw`"C:\Program Files\nodejs\node.exe" build && lint`, [String.raw`"C:\Program Files\nodejs\node.exe" build`, "lint"], undefined],
        ['cmd /c "echo a && echo b"', ['cmd /c "echo a && echo b"'], undefined],
        ['cmd /c "echo a" && cmd /c "echo b"', ['cmd /c "echo a"', 'cmd /c "echo b"'], undefined],
        [String.raw`"C:\dir\" && build`, [String.raw`"C:\dir\" && build`], "unbalanced quote"],
        [String.raw`dir C:\build && lint`, [String.raw`dir C:\build`, "lint"], undefined],
        ["echo ^&^& x", ["echo ^&^& x"], undefined],
    ];

    it.each(splitCases)("splits %j into %j (refused: %s)", (input, segments, refusedReason) => {
        expect.assertions(2);

        const result = splitCompoundCommand(input);

        expect(result.segments).toStrictEqual(segments);
        expect(result.refusedReason).toBe(refusedReason);
    });

    it("never returns more than the original text when refusing", () => {
        expect.assertions(1);

        const command = "cd app && build";

        expect(splitCompoundCommand(command).segments).toStrictEqual([command]);
    });
});
