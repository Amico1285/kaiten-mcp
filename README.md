# mcp-kaiten

[Русский](docs/README.ru.md) | [中文](docs/README.cn.md)

[Why mcp-kaiten exists](docs/WHYIEXIST.md)

MCP server for **Kaiten** — cards, time-logs, boards, comments, users.

Connect Cursor, Claude Desktop, or any MCP client to your Kaiten workspace.

Start with a single command: `npx -y mcp-kaiten`.

---

## Quick Start

### 1. Get API Token

1. Go to your Kaiten instance (e.g. `https://your-domain.kaiten.ru`)
2. Open Profile → API Key
3. Create a new token and copy it

### 2. Add to Cursor / MCP Client

```json
{
  "mcpServers": {
    "mcp-kaiten": {
      "command": "npx",
      "args": ["-y", "mcp-kaiten"],
      "env": {
        "KAITEN_API_TOKEN": "your-api-token",
        "KAITEN_URL": "https://your-domain.kaiten.ru"
      }
    }
  }
}
```

The server starts automatically when the MCP client connects.

---

## What Can It Do?

### Cards

| Tool | Description |
|------|-------------|
| `kaiten_get_card` | Get card by ID (with optional children) |
| `kaiten_search_cards` | Search cards with filters, dates, pagination |
| `kaiten_get_space_cards` | Get cards in a space |
| `kaiten_get_board_cards` | Get cards on a board |
| `kaiten_create_card` | Create a new card |
| `kaiten_update_card` | Update card fields, move between columns/boards |
| `kaiten_delete_card` | Delete a card |

### Comments

| Tool | Description |
|------|-------------|
| `kaiten_get_card_comments` | List comments for a card |
| `kaiten_create_comment` | Add a comment |
| `kaiten_update_comment` | Update a comment |
| `kaiten_delete_comment` | Delete a comment |

### Time Logs

| Tool | Description |
|------|-------------|
| `kaiten_get_user_timelogs` | Get time-logs for a user in a date range |
| `kaiten_get_card_timelogs` | Get time-logs for a card |
| `kaiten_create_timelog` | Create a time-log entry (requires `roleId`) |
| `kaiten_update_timelog` | Update a time-log entry |
| `kaiten_delete_timelog` | Delete a time-log entry (requires `cardId`) |

### Spaces & Boards

| Tool | Description |
|------|-------------|
| `kaiten_list_spaces` | List all spaces |
| `kaiten_get_space` | Get space by ID |
| `kaiten_list_boards` | List boards in a space |
| `kaiten_get_board` | Get board by ID |
| `kaiten_list_columns` | List columns (statuses) of a board |
| `kaiten_list_lanes` | List lanes (swimlanes) of a board |
| `kaiten_list_card_types` | List card types of a board |

### Subtasks

| Tool | Description |
|------|-------------|
| `kaiten_list_subtasks` | List child cards |
| `kaiten_attach_subtask` | Attach a card as subtask |
| `kaiten_detach_subtask` | Detach a subtask |

### Tags

| Tool | Description |
|------|-------------|
| `kaiten_list_tags` | List all workspace tags |
| `kaiten_add_tag` | Add a tag to a card |
| `kaiten_remove_tag` | Remove a tag from a card |

### Checklists

| Tool | Description |
|------|-------------|
| `kaiten_get_checklists` | Get checklists for a card |
| `kaiten_create_checklist` | Create a new checklist |
| `kaiten_delete_checklist` | Delete a checklist |
| `kaiten_add_checklist_item` | Add an item to a checklist |
| `kaiten_update_checklist_item` | Update a checklist item |

### Attachments

| Tool | Description |
|------|-------------|
| `kaiten_list_files` | List card attachments |
| `kaiten_upload_file` | Upload a file to a card |
| `kaiten_delete_file` | Delete a card attachment |

### Custom Fields

| Tool | Description |
|------|-------------|
| `kaiten_list_custom_properties` | List custom properties for a space |

### Users

| Tool | Description |
|------|-------------|
| `kaiten_get_current_user` | Get the authenticated user |
| `kaiten_list_users` | List all users |
| `kaiten_get_user_roles` | Get roles of the current user |

### Resources

| URI | Description |
|-----|-------------|
| `kaiten://spaces` | All spaces with IDs and titles |
| `kaiten://boards` | All boards across spaces (id, title, spaceId) |

### Prompts

| Name | Description |
|------|-------------|
| `create-card` | Step-by-step card creation workflow |
| `time-report` | Generate time tracking report for a date range |
| `board-overview` | Summarize board: columns, cards, overdue items |

---

## Authentication

Kaiten uses API tokens for authentication. OAuth is not supported by the Kaiten API.

1. Go to your Kaiten profile → API Key
2. Create and copy the token
3. Set `KAITEN_API_TOKEN` in MCP config

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `KAITEN_API_TOKEN` | yes | API token (Bearer) |
| `KAITEN_URL` | yes | Kaiten instance URL (e.g. `https://your-domain.kaiten.ru`) |
| `KAITEN_DEFAULT_SPACE_ID` | no | Default space ID for card search (if `spaceId` is not specified) |
| `KAITEN_ALLOWED_SPACE_IDS` | no | Comma-separated space IDs to restrict access |
| `KAITEN_ALLOWED_BOARD_IDS` | no | Comma-separated board IDs to restrict access |

---

## Verbosity

Every tool accepts an optional `verbosity` parameter (default: `min`) to control response size. Use `min` for compact responses that save LLM context, `normal` for common fields, `max` for full detail, or `raw` for the unprocessed API response.

## Reliability

- **Automatic retries:** failed requests (429, 5xx, network errors, timeouts) are retried up to 3 times with exponential backoff.
- **Idempotency:** write requests include idempotency keys to prevent duplicate mutations on retries.
- **Caching:** reference data (spaces, boards, users, roles) is cached with automatic background refresh.
- **Response optimization:** compact JSON, automatic truncation of large responses, verbosity control.
- **Crash protection:** unhandled errors are logged without crashing the server.
- **Actionable errors:** error messages include hints on what to do next.

## Troubleshooting

- **Server won't start:** check that `KAITEN_API_TOKEN` and `KAITEN_URL` are set in the MCP config `env` block.
- **401 errors:** token may be expired or invalid. Generate a new one in Kaiten profile.
- **Large responses:** use filters (`boardId`, `spaceId`) or lower `limit` to reduce response size.

---

[Changelog](CHANGELOG.md)

[License](LICENSE)
