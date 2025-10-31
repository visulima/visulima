# Options Examples

Demonstrates various option handling features in Cerebro CLI.

## Features

- **Common Options**: Basic option types, aliases, and default values
- **Default Values**: Options with default values
- **Negatable Options**: Boolean options that can be negated with `--no-` prefix
- **Conflicts**: Options that conflict with each other
- **Implies**: Options that automatically set other options
- **Required Options**: Options that must be provided
- **Boolean or Value**: Options that can be used as boolean flags or with values

## Run

### Using npm scripts:
```bash
pnpm start              # Show all available commands
pnpm common             # Run common options example
pnpm defaults           # Run defaults example
pnpm negatable          # Run negatable options example
pnpm conflicts          # Run conflicts example
pnpm implies            # Run implies example
pnpm required           # Run required options example
pnpm boolean-or-value   # Run boolean-or-value example
```

### Using node directly:
```bash
# Show all available commands
node cli.js help

# Common options
node cli.js options-common -p
node cli.js options-common -d -s -p vegetarian
node cli.js options-common --pizza-type=cheese

# Default values
node cli.js options-defaults
node cli.js options-defaults --cheese stilton

# Negatable options
node cli.js options-negatable
node cli.js options-negatable --sauce
node cli.js options-negatable --cheese=blue
node cli.js options-negatable --no-sauce --no-cheese

# Conflicting options
node cli.js options-single-conflicts --cash --credit-card
node cli.js options-multi-conflicts --colour=red --summer
node cli.js options-multi-conflicts --no-colour --autumn

# Options with implies
node cli.js options-implies
node cli.js options-implies --quiet
node cli.js options-implies --cheese=cheddar
node cli.js options-implies --no-cheese

# Required options
node cli.js options-required
node cli.js options-required --cheese blue

# Boolean or value options
node cli.js options-boolean-or-value
node cli.js options-boolean-or-value --cheese
node cli.js options-boolean-or-value --cheese mozzarella
```

