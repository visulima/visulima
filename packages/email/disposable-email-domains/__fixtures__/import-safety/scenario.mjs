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

// Twice, so a repeated warning would show up in the count.
const disposable = api.isDisposableDomain("sub.mailinator.com") && api.isDisposableDomain("sub.mailinator.com");

process.stdout.write(JSON.stringify({ disposable, listLoaded: api.isListLoaded(), notDisposable: !api.isDisposableEmail("a@example.com"), warnings }));
