# Kaiten MCP — LLM Guide

> This file is meant to be included in your CLAUDE.md (or equivalent) so the LLM has full context **before** calling any Kaiten tools.
> Add this line to your CLAUDE.md:
> ```
> Read ./node_modules/kaiten-mcp/LLM_GUIDE.md before working with Kaiten.
> ```

## Architecture

Kaiten is a project management system. Object hierarchy:

```
Company
 └─ Space (workspace)
     └─ Board (kanban board)
         ├─ Column (status: col_type 1=queued, 2=in_progress, 3=done)
         └─ Lane (swimlane, optional)
             └─ Card (task)
                 ├─ Checklist → Items (to-do rows)
                 ├─ Comments (markdown or html)
                 ├─ Tags (workspace-wide labels)
                 ├─ Members (type 1=member, 2=responsible)
                 ├─ Blockers (soft-release only, no hard-delete)
                 ├─ External Links (URLs — Jira, GitHub, etc.)
                 ├─ Files (attachments, URL-based)
                 ├─ Subtasks (linked child cards)
                 ├─ Timelogs (time spent in minutes)
                 └─ Custom Properties (company-defined fields)
```

**Critical:** `state` is **computed** from `column.col_type`. You cannot set state directly — move the card to a column with the desired type.

## Common Workflows

### Create a card
1. `kaiten_list_boards(spaceId)` → pick `boardId`
2. `kaiten_list_columns(boardId)` → pick `columnId` (check `col_type` for desired state)
3. `kaiten_create_card(boardId, columnId, title, ...)` — optional: `description`, `sizeText`, `dueDate`, `tags`, `textFormat`

### Move a card (change state)
1. `kaiten_list_columns(boardId)` → find column with target `col_type`
2. `kaiten_update_card(cardId, columnId=targetColumnId)`

### Enrich a card
All of these are independent and can run in parallel:
- `kaiten_add_tag(cardId, name)` — auto-creates tag if it doesn't exist
- `kaiten_create_checklist(cardId, name)` → `kaiten_add_checklist_item(cardId, checklistId, text)`
- `kaiten_create_comment(cardId, text)` — markdown by default
- `kaiten_create_timelog(cardId, timeSpentMinutes, roleId)` — get roleId from `kaiten_list_company_roles`
- `kaiten_upload_file(cardId, fileName, contentBase64)`
- `kaiten_add_card_external_link(cardId, url, description)`
- `kaiten_add_card_member(cardId, userId)` → optionally `kaiten_set_card_responsible(cardId, userId)`
- `kaiten_attach_subtask(parentCardId, childCardId)` — child must be created first

### Search and filter
- `kaiten_search_cards(boardId, ...)` — filters: `state`, `tagIds`, `asap`, `ownerId`, `query` (title substring), date ranges
- `kaiten_get_board_cards(boardId)` — simple newest-first list, no filters
- `kaiten_get_card(cardId, verbosity="max", includeChildren=true)` — full detail with embedded children

### Time tracking audit
- `kaiten_get_user_timelogs(userId, from, to)` — one user's logs across all cards
- `kaiten_get_timesheet(from, to, boardIds=[...])` — cross-user report for a scope
- `kaiten_get_card_timelogs(cardId)` — all logs on one card

## Verbosity Levels

All read tools accept `verbosity`:
- `min` (default) — 5-10 core fields, smallest context footprint
- `normal` — mid-detail with IDs, dates, tags, members
- `max` — strict superset of normal, adds description, children, checklists, nested objects
- `raw` — unprocessed Kaiten API response (for debugging only)

Use `min` for listings and `max` when you need full card detail.

## Text Format

Card descriptions and comments default to **markdown**. If sending HTML, always pass `textFormat: "html"` — without it, Kaiten stores raw HTML and the UI shows literal angle brackets.

**Comment-specific limitation:** Kaiten's comment markdown parser does NOT support ATX headings (`### Header` renders as literal text). Bold, italic, lists, code blocks, links, and blockquotes all work. Card descriptions DO support headings — the limitation is comment-only. Use bold text or switch to HTML for headings in comments.

Avoid `textFormat: "jira_wiki"` — Kaiten's parser is incomplete (italic broken, code block underscores mangled).

## API Quirks and Pitfalls

### Fields that don't work as expected

| Field | What you'd expect | What actually happens |
|---|---|---|
| `state` | PATCH `{state:2}` sets in_progress | **Silently ignored.** Move via `columnId` instead |
| `size` (number) | PATCH `{size:5}` sets size | **Rejected.** Use `sizeText: "5 SP"` (string) |
| `owner_id: null` | Remove owner | **400 error.** Owner is mandatory — can only reassign |
| `condition: 3` | "All cards" filter | **Returns only deleted cards.** Use 1 (live) or 2 (archived), call twice to get both |
| `due_date` alone | Date visible in UI | **Hidden** unless `dueDateTimePresent: true` (auto-set when you pass `dueDate` through MCP tools) |

### Blocker semantics
- `DELETE` = **soft release** (flips `released:true`, row stays in list). No hard-delete API.
- `PATCH` with `{released:true}` is **silently stripped** — no effect.
- When the blocking card moves to **done**, Kaiten **auto-releases** the blocker (`released_by_id: -1`). No manual release needed.
- `kaiten_list_card_blockers` returns **all** blockers including released. Filter by `released` field client-side.

### Silent fails to watch for
- Empty PATCH body → **403** (not 400)
- Non-existent sprint → **403** (not 404)
- `search_cards` with conflicting `boardId` + `spaceId` → silent **empty array** (no error)
- Deleting a card with time logs → **400** "Card removing with logged time not allowed" — delete timelogs first

### Things that are idempotent
- `kaiten_add_tag` — re-adding same tag name returns same tagId, no duplicate
- `kaiten_attach_subtask` — re-attaching same pair returns success
- `kaiten_add_card_member` — re-adding same user returns success

## Error Recovery

| Status | Meaning | What to do |
|---|---|---|
| **401** | Token expired or invalid | Regenerate at Profile → API Key |
| **403** | Access denied **or** ID not found | Check permissions AND verify the ID via the relevant `kaiten_list_*` tool |
| **404** | Resource not found | Use the recovery tool suggested in the error message |
| **409** | Concurrent modification | Re-read the resource and retry |
| **422** | Validation error | Check required fields and value formats |

Each error message includes a **context-aware hint** suggesting which list tool to call to verify the problematic ID. Follow that hint.

## Tool Selection Quick Reference

| I want to... | Use |
|---|---|
| Find cards by title | `kaiten_search_cards(query="...")` |
| List all cards on a board | `kaiten_get_board_cards(boardId)` |
| Get full card detail | `kaiten_get_card(cardId, verbosity="max")` |
| See card with children | `kaiten_get_card(cardId, includeChildren=true)` |
| See who's assigned | `kaiten_list_card_members(cardId)` — returns `type` (1=member, 2=responsible) |
| Track card movements | `kaiten_get_card_location_history(cardId)` |
| Time report for a person | `kaiten_get_user_timelogs(userId, from, to)` |
| Time report for a board | `kaiten_get_timesheet(from, to, boardIds=[boardId])` |
| See all workspace tags | `kaiten_list_workspace_tags()` |
| See tags on a card | `kaiten_list_card_tags(cardId)` |
| Check card blockers | `kaiten_list_card_blockers(cardId)` — includes released ones |
| List available roles | `kaiten_list_company_roles()` — roleId for timelogs |

## Capabilities Not Available via MCP

These operations require the Kaiten web UI:
- Creating/deleting spaces, boards, columns, lanes
- Managing workspace-level tag cleanup (orphaned tags)
- User management and permissions
- Sprint creation and management
- Board-level automation rules
