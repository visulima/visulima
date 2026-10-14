// Child-process driver for __tests__/integration/import-safety.test.ts.
// Usage: node scenario.mjs <entry> <inject|empty|preload> [--no-builtins]
// Prints one JSON line describing what the built entry did.
const [entry, scenario, flag] = process.argv.slice(2);

let warnings = 0;

console.warn = () => {
    warnings += 1;
};

if (flag === "--no-builtins") {
    delete process.getBuiltinModule;
}

const api = await import(entry);

if (scenario === "inject") {
    api.setDomains(["mailinator.com"]);
} else if (scenario === "preload") {
    await api.preload();
}

// Two separate calls (not `a && b`, which short-circuits on false), so a repeated warning shows up in the count.
const first = api.isDisposableDomain("sub.mailinator.com");
const second = api.isDisposableDomain("sub.mailinator.com");
const disposable = first && second;

process.stdout.write(JSON.stringify({ disposable, listLoaded: api.isListLoaded(), notDisposable: !api.isDisposableEmail("a@example.com"), warnings }));
