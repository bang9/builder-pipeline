# builder-pipeline

Shipping an app involves a lot of tedious work beyond the actual code — creating App Store listings, generating icon variants, writing descriptions, managing bundle IDs, preparing screenshots, and so on.

This toolkit automates all of that. One command, done. Powered by AI and scripts.

## Getting Started

```bash
# 1. Clone
git clone https://github.com/bang9/builder-pipeline.git
cd builder-pipeline

# 2. Install dependencies
pnpm install

# 3. Set up environment
cp .env.sample .env
# Fill in your .env values

# 4. Run (TBD)
```

## Project Structure

```
builder-pipeline/
├── packages/          # Core feature libraries
│   ├── core/          # Shared utilities, types, config
│   ├── icon-gen/      # App icon generation & resizing
│   └── ...
├── apps/              # User-facing interfaces
│   ├── cli/           # Command-line tool
│   ├── dashboard/     # Web dashboard (TBD)
│   └── ...
├── .env.sample
├── pnpm-workspace.yaml
└── package.json
```

## Tech Stack

- **Runtime**: Node.js >= 20
- **Language**: TypeScript (ESM)
- **Package Manager**: pnpm (monorepo)

## License

MIT
