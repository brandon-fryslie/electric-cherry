# Electric Cherry — Electron debugging MCP server

entry := justfile_directory() / "build" / "src" / "index.js"

# Install dependencies and build
setup:
    npm install
    npm run build

# Build the MCP server
build:
    npm run build

# Run tests
test:
    npm test

# Install as a Claude Code MCP server into a project directory
install-claude dir:
    cd {{dir}} && claude mcp add --scope project electric-cherry -- node {{entry}}

# Uninstall from a project directory
uninstall-claude dir:
    cd {{dir}} && claude mcp remove electric-cherry

# Rebuild and reinstall into a project directory
reinstall-claude dir:
    -cd {{dir}} && claude mcp remove electric-cherry
    cd {{dir}} && claude mcp add --scope project electric-cherry -- node {{entry}}
