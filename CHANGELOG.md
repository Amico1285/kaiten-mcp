# Changelog

## [1.1.0] - 2026-03-21

### Added
- **Checklists (5):** create, get, delete checklist; add, update checklist item
- **Tags (3):** list tags, add tag to card, remove tag from card
- **Subtasks (3):** list, attach, detach child cards
- **Files (3):** list, upload (multipart), delete attachments
- **Custom fields (1):** list custom properties per space
- Integration tests for all 41 tools (single-card workflow)
- New test suites: checklists, tags, subtasks, files, custom-fields

### Fixed
- `kaiten_add_tag` — API requires `name` field, not `tag_id`; now resolves name from tag cache
- `kaiten_upload_file` — switched from JSON body to multipart/form-data (Kaiten API requirement)

### Changed
- All tool descriptions now use full `kaiten_*` prefixed names for LLM clarity
- `state` parameter describes allowed values: `draft|queued|in_progress|done`
- `forDate` parameter includes ISO 8601 format hint
- `kaiten_detach_subtask` annotation: `destructiveHint` corrected to `false` (unlink, not delete)
- `kaiten_upload_file` annotation: `idempotentHint` corrected to `false` (creates duplicates)
- Resource descriptions expanded with cross-references to related tools
- Unified verbosity describe format across all tools

## [1.0.2] - 2026-03-21

### Fixed
- Corrected sort parameters for board and space card listing

### Changed
- Card types endpoint is now global — no board ID required
- Condition filter supports "all" option (1=active, 2=archived, 3=all)
- Improved tool descriptions with references to related tools

## [1.0.1] - 2026-03-20

### Fixed
- Fixed API endpoints for card creation, search, board/space listing, and card types
- Time-log creation now requires role ID (mandatory Kaiten API field)
- Time-log deletion now requires card ID (alternative endpoint bypassing WAF)

### Added
- Russian README
- Integration tests auto-cleanup on failure

### Changed
- Time-log update supports optional role ID

## [1.0.0] - 2026-03-20

### Features — 26 tools
- **Cards (7):** get, search, list by space/board, create, update, delete
- **Comments (4):** list, create, update, delete
- **Time Logs (5):** get by user/card, create, update, delete
- **Spaces & Boards (7):** list spaces/boards/columns/lanes/card types, get space, get board
- **Users (3):** current user, list users, user roles

### Search & Filtering
- Filters: board, space, column, lane, owner, type, state, dates, urgency, overdue
- Multi-ID filters: owners, members, tags
- Default: 20 results, sorted by creation date (newest first)

### Response Optimization
- 4 verbosity levels: `min` (default), `normal`, `max`, `raw`
- `min` reduces response size by ~95%
- Auto-generated card URLs

### Reliability
- HTTP request timeout via `AbortController` (default 10s)
- Automatic retries with exponential backoff (429, 5xx, network errors, timeouts)
- `Retry-After` header support
- TTL cache for reference data (spaces, boards, columns, lanes, card types, users)
- Response truncation at 100k chars
- Crash protection
- Env validation via Zod at startup

### Configuration
- `KAITEN_API_TOKEN` — API token (required)
- `KAITEN_URL` — instance URL (required)
- `KAITEN_DEFAULT_SPACE_ID` — auto-applied to search
- `KAITEN_REQUEST_TIMEOUT_MS` — HTTP timeout (default 10000)
- `KAITEN_CACHE_TTL_MS` — cache TTL (default 300000, 0 to disable)
