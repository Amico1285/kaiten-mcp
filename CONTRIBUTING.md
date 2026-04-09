# Contributing to kaiten-mcp

Thank you for your interest in contributing! This guide covers everything you need to get started.

## Prerequisites

- **Node.js** 18+ (tested on 18, 20, 22)
- **npm** 9+
- A **Kaiten workspace** with an API token (for live testing)

## Setup

```bash
git clone https://github.com/Amico1285/kaiten-mcp.git
cd kaiten-mcp
npm install
npm run build
```

The build compiles TypeScript from `src/` into `build/` and makes `build/index.js` executable.

### Running locally

To test with an MCP client, point it at your local build:

```json
{
  "mcpServers": {
    "kaiten": {
      "command": "node",
      "args": ["/absolute/path/to/kaiten-mcp/build/index.js"],
      "env": {
        "KAITEN_API_TOKEN": "your-token",
        "KAITEN_URL": "https://your-company.kaiten.ru"
      }
    }
  }
}
```

### Watch mode

```bash
npm run dev  # runs tsc --watch
```

### MCP Inspector

```bash
npm run inspector  # opens the MCP Inspector UI
```

## Project structure

```
src/
  index.ts          # Server entry point, tool registration
  client.ts         # HTTP client (GET/POST/PATCH/DELETE + retry + sanitizer)
  resources.ts      # MCP resources and prompts
  tools/
    cards.ts        # Card CRUD + search + location history
    comments.ts     # Comment CRUD
    timelogs.ts     # Timelog CRUD + timesheet
    spaces.ts       # Spaces, boards, columns, lanes, subcolumns
    users.ts        # Users, roles
    subtasks.ts     # Subtask attach/detach
    tags.ts         # Tag add/remove
    checklists.ts   # Checklist CRUD + items
    files.ts        # File upload/delete
    customFields.ts # Custom properties + select values
    members.ts      # Card member CRUD + responsible
    blockers.ts     # Card blocker CRUD + release
    externalLinks.ts # External link CRUD
    sprints.ts      # Sprint list/get
  utils/
    errors.ts       # Error handling, jsonResult/textResult helpers
    schemas.ts      # Zod schema helpers (positiveId, boolish, etc.)
    simplify.ts     # Response simplification (min/normal/max/raw)
    preflight.ts    # Cross-resource ownership checks
    queryBuilder.ts # Search query parameter builder
```

## Code style

- **TypeScript strict mode** — the project uses `strict: true` in `tsconfig.json`
- **No external linter** — keep code consistent with the existing style (2-space indent, explicit types on public functions, `const` over `let`)
- **Zod for input validation** — all tool inputs are Zod schemas. Use helpers from `utils/schemas.ts` (`positiveId`, `optionalPositiveId`, `boolish`, `isoDate`, etc.)
- **Inline simplifiers** — each tool family has its own `simplifyX()` function. The `min` -> `normal` -> `max` ladder must be a strict superset chain

## Adding a new tool

1. **Check the API docs** in `docs/api/` (if available) or the [Kaiten API documentation](https://developers.kaiten.ru)
2. **Add the tool** in the appropriate `src/tools/*.ts` file using `server.registerTool()`
3. **Add a simplifier** following the `min` -> `normal` -> `max` -> `raw` pattern
4. **Wire it up** in `src/index.ts` (if creating a new tool family file)
5. **Update `LLM_GUIDE.md`** if the tool introduces new workflows or quirks
6. **Update `README.md`** (both EN and `docs/README.ru.md`) with the tool in the appropriate table
7. **Build and test** — `npm run build` must pass cleanly

### Tool registration checklist

- [ ] `inputSchema` uses Zod schemas from `utils/schemas.ts`
- [ ] `description` is LLM-friendly: explains what to pass, what to expect, cross-references related tools
- [ ] `annotations` are set correctly (`readOnlyHint`, `destructiveHint`, `idempotentHint`)
- [ ] Mutating tools with parent+child IDs use `assertChildBelongsToParent` preflight
- [ ] Update tools use `requireSomeFields` to reject empty patches
- [ ] Response uses `jsonResult()` / `textResult()` from `utils/errors.ts`

## Testing

There are no unit tests in this repo. The source of truth for correctness is **live testing against a real Kaiten workspace** — every tool is exercised via MCP and verified through the API and UI.

Before submitting a PR:

1. `npm run build` must succeed
2. `npx tsc --noEmit` must pass (type check)
3. If you changed or added a tool, test it live against a Kaiten workspace

## Pull requests

- **One logical change per PR** — don't mix unrelated fixes
- **Branch from `main`** — name your branch descriptively (e.g. `fix/search-tag-filter`, `feat/archive-card`)
- **Fill in the PR template** — it asks for a summary and test plan
- **Keep the PR focused** — if you notice an unrelated issue, open a separate issue or PR

## Reporting bugs

Please [open an issue](https://github.com/Amico1285/kaiten-mcp/issues/new?template=bug_report.yml) with:

- Which tool failed
- What you expected vs. what happened
- The error message (if any)
- Your Node.js version and MCP client

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
