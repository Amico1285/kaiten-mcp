# kaiten-mcp

[![npm version](https://img.shields.io/npm/v/kaiten-mcp.svg)](https://www.npmjs.com/package/kaiten-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[Русский](docs/README.ru.md)

[Why kaiten-mcp exists](docs/WHYIEXIST.md)

MCP server for **Kaiten** — 63 tools covering cards, comments, checklists, time tracking, members, blockers, sprints, custom properties, external links, file uploads, location history, and a global timesheet.

Connect Cursor, Claude Desktop, Claude Code, or any MCP client to your Kaiten workspace.

Start with a single command: `npx -y kaiten-mcp`.

This is a fork of [iamtemazhe/mcp-kaiten](https://github.com/iamtemazhe/mcp-kaiten) with extensive Wave 1–5 fixes: 22 net new tools, schema repairs, preflight checks, response simplification ladders, and reliability improvements. See [WHYIEXIST.md](docs/WHYIEXIST.md) and the [CHANGELOG](CHANGELOG.md).

---

## Quick Start

### 1. Get an API token

1. Open your Kaiten instance (e.g. `https://your-company.kaiten.ru`)
2. Profile → API Key
3. Create a token and copy it

### 2. Add to your MCP client

```json
{
  "mcpServers": {
    "kaiten": {
      "command": "npx",
      "args": ["-y", "kaiten-mcp"],
      "env": {
        "KAITEN_API_TOKEN": "your-api-token",
        "KAITEN_URL": "https://your-company.kaiten.ru"
      }
    }
  }
}
```

That's it. The server starts automatically when the MCP client connects. There is no `user_id` to configure — the current user is resolved automatically from the token.

---

## What can it do?

**63 tools across 14 families.** Every tool accepts an optional `verbosity` parameter (`min` / `normal` / `max` / `raw`) to control response size.

### Cards (8)

| Tool | Description |
|------|-------------|
| `kaiten_get_card` | Get card by ID, with optional children |
| `kaiten_search_cards` | Search cards with 15+ filters, dates, pagination |
| `kaiten_get_space_cards` | Cards in a space |
| `kaiten_get_board_cards` | Cards on a board |
| `kaiten_create_card` | Create a new card |
| `kaiten_update_card` | Update fields, move between columns/boards, set custom property values |
| `kaiten_delete_card` | Delete a card (fails if it has logged time — delete time logs first) |
| `kaiten_get_card_location_history` | Audit trail: how long the card sat in each column (Wave 5) |

### Comments (4)

| Tool | Description |
|------|-------------|
| `kaiten_get_card_comments` | List comments for a card |
| `kaiten_create_comment` | Add a comment |
| `kaiten_update_comment` | Update a comment |
| `kaiten_delete_comment` | Delete a comment |

### Time logs (6)

| Tool | Description |
|------|-------------|
| `kaiten_get_user_timelogs` | Time logs for a user in a date range |
| `kaiten_get_card_timelogs` | Time logs for a card |
| `kaiten_create_timelog` | Create a time-log entry (requires `roleId`) |
| `kaiten_update_timelog` | Update a time-log entry |
| `kaiten_delete_timelog` | Delete a time-log entry (requires `cardId`) |
| `kaiten_get_timesheet` | Global timesheet across users/spaces/boards (Wave 5) |

### Spaces & boards (9)

| Tool | Description |
|------|-------------|
| `kaiten_list_spaces` | List all spaces |
| `kaiten_get_space` | Get space by ID |
| `kaiten_list_boards` | List boards in a space |
| `kaiten_get_board` | Get board by ID (with inline columns/lanes at `verbosity=max`) |
| `kaiten_list_columns` | Columns (statuses) of a board |
| `kaiten_list_subcolumns` | Sub-columns inside a parent column (Wave 5) |
| `kaiten_list_lanes` | Lanes (swimlanes) of a board |
| `kaiten_list_card_types` | Card types (global to the company) |
| `kaiten_list_space_users` | Users assigned to a specific space |

### Subtasks (3)

| Tool | Description |
|------|-------------|
| `kaiten_list_subtasks` | List child cards |
| `kaiten_attach_subtask` | Attach a card as a subtask |
| `kaiten_detach_subtask` | Detach a subtask |

### Tags (4)

| Tool | Description |
|------|-------------|
| `kaiten_list_card_tags` | Tags currently on a card |
| `kaiten_list_workspace_tags` | All tags defined in the workspace |
| `kaiten_add_tag` | Add a tag to a card (auto-creates the tag if it doesn't exist) |
| `kaiten_remove_tag` | Remove a tag from a card |

### Checklists (7)

| Tool | Description |
|------|-------------|
| `kaiten_get_checklist` | Get a checklist with its items |
| `kaiten_create_checklist` | Create a new checklist on a card |
| `kaiten_delete_checklist` | Delete a checklist |
| `kaiten_rename_checklist` | Rename a checklist |
| `kaiten_add_checklist_item` | Add an item to a checklist |
| `kaiten_update_checklist_item` | Update an item (text, checked, due date, responsible) |
| `kaiten_delete_checklist_item` | Delete a checklist item |

### Files (3)

| Tool | Description |
|------|-------------|
| `kaiten_list_files` | List card attachments |
| `kaiten_upload_file` | Upload a file to a card |
| `kaiten_delete_file` | Delete a card attachment |

### Custom fields (2)

| Tool | Description |
|------|-------------|
| `kaiten_list_custom_properties` | List custom properties available in the workspace |
| `kaiten_list_custom_property_select_values` | List allowed values for a `select` / `multi_select` property (Wave 5) |

### Users (3)

| Tool | Description |
|------|-------------|
| `kaiten_get_current_user` | The authenticated user |
| `kaiten_list_users` | All users in the workspace |
| `kaiten_list_company_roles` | Roles defined at the company level (renamed from `get_user_roles`) |

### Card members (4) — Wave 4

| Tool | Description |
|------|-------------|
| `kaiten_list_card_members` | Members assigned to a card |
| `kaiten_add_card_member` | Add a user as a card member |
| `kaiten_remove_card_member` | Remove a member from a card |
| `kaiten_set_card_responsible` | Set the responsible user (the card always has an owner — only re-assignment) |

### Card blockers (4) — Wave 4

| Tool | Description |
|------|-------------|
| `kaiten_list_card_blockers` | Blockers on a card |
| `kaiten_add_card_blocker` | Add a blocker (free-form reason or referencing another card) |
| `kaiten_update_card_blocker` | Update blocker reason or referenced card |
| `kaiten_release_card_blocker` | Release a blocker (soft release — flips `released:true`, the row stays in the list) |

### Card external links (4) — Wave 5

| Tool | Description |
|------|-------------|
| `kaiten_list_card_external_links` | List external links on a card |
| `kaiten_add_card_external_link` | Link the card to a Jira ticket, GitHub issue, etc. |
| `kaiten_update_card_external_link` | Update a link's URL or description |
| `kaiten_remove_card_external_link` | Remove a link (true hard-delete, unlike blockers) |

### Sprints (2) — Wave 5

| Tool | Description |
|------|-------------|
| `kaiten_list_sprints` | List sprints visible to the user |
| `kaiten_get_sprint` | Get a sprint summary with its cards |

### Resources

| URI | Description |
|-----|-------------|
| `kaiten://spaces` | All spaces with IDs and titles |
| `kaiten://boards` | All boards across spaces (id, title, spaceId) |

### Prompts

| Name | Description |
|------|-------------|
| `create-card` | Step-by-step card creation workflow |
| `time-report` | Time tracking report for a date range |
| `board-overview` | Summarize a board: columns, cards, overdue items |

---

## Authentication

Kaiten uses API tokens. OAuth is not supported by the Kaiten API.

1. Profile → API Key in your Kaiten instance
2. Create a token, copy it
3. Set `KAITEN_API_TOKEN` and `KAITEN_URL` in your MCP client config

The current user is detected automatically — you don't need to set a user ID anywhere.

---

## Environment variables

**Only two variables are required**: `KAITEN_API_TOKEN` and `KAITEN_URL`. Everything else is optional and exists for performance/safety tuning.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `KAITEN_API_TOKEN` | **yes** | — | API token (Bearer) |
| `KAITEN_URL` | **yes** | — | Kaiten instance URL, e.g. `https://your-company.kaiten.ru` |
| `KAITEN_DEFAULT_SPACE_ID` | no | — | Default space ID for `kaiten_search_cards` when `spaceId` is omitted. Without it, the LLM will discover spaces via `kaiten_list_spaces` first time it needs to search — costs one extra round-trip. Useful if you have many spaces and want to pin search to one. |
| `KAITEN_REQUEST_TIMEOUT_MS` | no | `10000` | HTTP request timeout in milliseconds |
| `KAITEN_CACHE_TTL_MS` | no | `300000` | TTL for cached reference data (spaces, boards, users, roles) |
| `KAITEN_ALLOWED_SPACE_IDS` | no | — | Comma-separated whitelist of space IDs the AI can access (multi-team safety) |
| `KAITEN_ALLOWED_BOARD_IDS` | no | — | Comma-separated whitelist of board IDs |

### Finding IDs from the browser URL

You don't need a developer console — every Kaiten ID is visible in the browser address bar.

- **Space ID** — click a space in the left menu, look at the URL: `https://your-company.kaiten.ru/space/762572` → space ID is `762572`.
- **Board ID** — click a board, look at the URL: `https://your-company.kaiten.ru/space/762572/boards/1727446` → board ID is `1727446`.
- **Card ID** — open a card, look at the URL: `https://your-company.kaiten.ru/space/762572/card/63258149` → card ID is `63258149` (also visible in the card header as `#63258149`).

These are the values you put into `KAITEN_DEFAULT_SPACE_ID`, `KAITEN_ALLOWED_SPACE_IDS`, and `KAITEN_ALLOWED_BOARD_IDS`.

---

## Verbosity

Every tool accepts an optional `verbosity` parameter (default: `min`):

| Level | Description |
|-------|-------------|
| `min` | Compact response, saves LLM context — only key fields |
| `normal` | Common fields — strict superset of `min` |
| `max` | Full detail — strict superset of `normal`, includes nested children where relevant |
| `raw` | Unprocessed API response, no transformation |

The `min` → `normal` → `max` ladder is a strict superset chain (Wave 4 PR 4.6) — anything visible at `min` is also visible at `normal` and `max`.

## Reliability

- **Cross-resource preflight** (Wave 4 PR 4.7): mutating tools that take both a parent ID and a child ID (e.g. card + comment, card + checklist) verify the child belongs to the parent before sending the mutation. Prevents silent cross-resource bugs.
- **Author enrichment** (Wave 2): comment/timelog responses include `author_name` even when the API returns only `author_id` — the current user's name is filled in client-side.
- **Context-aware error hints** (Wave 4 PR 4.5): error messages from the API include a hint about which related read tool to call to recover (e.g. "404 on `/cards/{id}` → try `kaiten_search_cards`").
- **Automatic retries**: failed requests (429, 5xx, network errors, timeouts) are retried up to 3 times with exponential backoff and jitter. The `Retry-After` header is honored.
- **Idempotency**: write requests include idempotency keys to prevent duplicate mutations on retries.
- **Caching**: spaces, boards, users, roles cached in-memory with configurable TTL. Stale data is returned immediately while a background refresh runs.
- **Crash protection**: unhandled errors are logged without crashing the server.
- **Response truncation**: very large responses are auto-truncated to protect the LLM context window.

---

## Kaiten API quirks worth knowing

These are real Kaiten-side behaviors discovered during Wave 4–5 implementation. Each is mitigated in the corresponding tool, but the LLM will see them in tool descriptions.

- **`update_card.state` is read-only.** The card's `state` is computed from `column.type` (1→queued, 2→in_progress, 3→done). To change state, move the card with `column_id`.
- **`update_card.size` doesn't accept a number.** Use `sizeText: "5 SP"` (sent as `size_text`) or `estimate_workload` in seconds.
- **`owner_id` cannot be cleared.** Cards always have an owner. You can only re-assign, not remove.
- **Empty `PATCH /cards/{id}`** returns 403 (a quirk of the API itself). The server validates this client-side and returns a clearer error.
- **Blocker `DELETE` is a soft release.** It flips `released:true` but keeps the row in the list endpoint. The tool is named `kaiten_release_card_blocker` (not `remove_*`) to make this explicit.
- **External-link `DELETE` is a true hard-delete.** Asymmetric with blockers — the link disappears.
- **`location_history.id` is a string**, not a number — it's preserved as-is (Number-parsing would lose precision for IDs > 2^53).
- **Sprint not-found returns 403, not 404.** Both are handled by the error hint helper.
- **Timesheet rejects empty array filters.** `card_ids=` (empty value) returns 400. Empty arrays are skipped from the query string entirely.
- **Card descriptions and comments default to markdown.** Kaiten's UI renders descriptions and comments as markdown. If you send raw HTML without telling Kaiten, the angle brackets stay in the body and the UI shows them as literal text. To send HTML, pass `textFormat: 'html'` to `kaiten_create_card` / `kaiten_update_card` / `kaiten_create_comment` / `kaiten_update_comment` — the server will then parse and normalize. Discovered live during the 0.1.1 → 0.1.2 dogfooding round (cards use the documented `text_format_type_id`; comments use an undocumented `type` field that we verified works).
- **Workspace tags can't be deleted via the API.** Kaiten's `/tags` endpoint only supports `GET` and `POST` (verified `docs/api/tags/`). `kaiten_remove_tag` only detaches a tag from a card — it doesn't remove it from the workspace pool. Orphan workspace tags accumulate over time and can only be cleaned up via the Kaiten admin UI.

## LLM Guide

The package ships with [`LLM_GUIDE.md`](LLM_GUIDE.md) — a comprehensive reference designed to be read by an LLM **before** it starts using the tools. It covers the Kaiten object hierarchy, common workflows, API quirks, error recovery patterns, and a tool selection quick-reference.

### How to use it

Add this line to your project's `CLAUDE.md` (or equivalent instructions file):

```
Read ./node_modules/kaiten-mcp/LLM_GUIDE.md before working with Kaiten.
```

This gives the LLM full context about Kaiten's data model and the non-obvious behaviors (like `state` being computed from `column.type`, or blocker soft-release semantics) before it makes its first tool call.

The guide is included in the npm package — it's available at `node_modules/kaiten-mcp/LLM_GUIDE.md` after `npx -y kaiten-mcp` runs.

---

## Troubleshooting

- **Server won't start:** check that `KAITEN_API_TOKEN` and `KAITEN_URL` are set in the MCP config `env` block.
- **401 errors:** the token may be expired or invalid — generate a new one in your Kaiten profile.
- **Large responses:** use filters (`boardId`, `spaceId`) or lower the `limit`.
- **403 on a write operation:** check the card isn't archived and that your token has write access to the space.

---

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, code style, and PR guidelines.

---

[Changelog](CHANGELOG.md) · [Contributing](CONTRIBUTING.md) · [License](LICENSE)
