# Completion Example

Demonstrates shell autocompletion integration with `@bomb.sh/tab`.

## Prerequisites

Install the optional peer dependency:

```bash
pnpm add @bomb.sh/tab
```

## Run

### Using npm scripts:
```bash
pnpm start                  # Show help
pnpm build                  # Run build command
pnpm serve                  # Run serve command
pnpm test                   # Run test command

# Generate completion scripts
pnpm completion:zsh         # Generate zsh completion
pnpm completion:bash        # Generate bash completion
pnpm completion:fish        # Generate fish completion
pnpm completion:powershell  # Generate powershell completion
```

### Using node directly:
```bash
# Show help
node cli.js help

# Run example commands
node cli.js build
node cli.js build --output dist --watch
node cli.js serve --port 8080
node cli.js test --coverage

# Generate completion script for your shell
node cli.js completion --shell=zsh
node cli.js completion --shell=bash
node cli.js completion --shell=fish
node cli.js completion --shell=powershell
```

## Install Completions

### Zsh

```bash
node cli.js completion --shell=zsh > ~/.example-cli-completion.zsh
echo 'source ~/.example-cli-completion.zsh' >> ~/.zshrc
```

### Bash

```bash
node cli.js completion --shell=bash > ~/.example-cli-completion.bash
echo 'source ~/.example-cli-completion.bash' >> ~/.bashrc
```

### Fish

```bash
node cli.js completion --shell=fish > ~/.config/fish/completions/example-cli.fish
```

### PowerShell

```powershell
node cli.js completion --shell=powershell > ~/.example-cli-completion.ps1
echo '. ~/.example-cli-completion.ps1' >> $PROFILE
```

## Features

- Automatic command discovery
- Option autocompletion
- Works across bash, zsh, fish, and powershell
- Minimal setup required

