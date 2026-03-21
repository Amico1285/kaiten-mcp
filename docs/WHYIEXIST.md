# Why mcp-kaiten exists

## Problem

Kaiten is a popular project management tool, but existing solutions for MCP integration have trade-offs:

- Some implementations auto-generate 246 tools from the API, overwhelming AI context
- Others focus on infrastructure (logging, metrics, diagnostics) but lack time tracking, checklists, tags, and attachments
- Still other implementations integrate git operations but have no retry, timeout, or caching
- Few alternative servers cover the full card lifecycle while keeping the tool count manageable

## What mcp-kaiten gives you

### 1. Full card lifecycle in 41 tools

Covers the complete workflow around Kaiten cards without overwhelming the AI:

**Cards** — Create, read, update, delete, search with 15+ filters, list by space or board

**Subtasks** — List child cards, attach and detach subtasks

**Comments** — List, create, update, and delete card comments

**Time tracking** — Full CRUD for time logs, fetch by user or by card for any date range

**Spaces and boards** — Navigate the workspace structure: spaces, boards, columns, lanes, card types

**Tags** — List all tags, add and remove tags from cards

**Checklists** — Create, read, and delete checklists; add and update checklist items

**Attachments** — List, upload, and delete card files

**Custom fields** — List available custom properties for a space

**Users** — Get current user, list all users, get user roles

### 2. Balanced tool count

41 tools is enough for real-world scenarios without flooding the AI context. Other implementations with comparable domain coverage may expose 246 tools (for example, auto-generated from the full API). Infrastructure-focused alternative servers with a similar scope often ship 26 tools but lack time tracking, checklists, tags, attachments, and custom fields.

### 3. End-to-end response optimization

The entire request-response pipeline is optimized for AI consumption:

- Only needed data is fetched from the API, reference data is cached
- 4 verbosity levels with type-specific simplification for every entity
- Automatic truncation prevents oversized responses from consuming context
- Tool descriptions include workflow hints and cross-references between related tools
- Compact JSON output saves tokens

### 4. Reliability

- Automatic retries with exponential backoff and jitter for server errors, rate limits, and network failures
- Idempotency protection prevents duplicate mutations on retries
- Configurable request timeouts
- Crash protection for unhandled errors
- Automatic response truncation
- Structured logging with configurable levels
- Actionable error messages with hints on how to fix the issue

### 5. Smart caching

Spaces, boards, columns, lanes, card types, users, and tags are cached in memory with configurable TTL. Stale data is returned immediately while a background refresh runs — the caller never waits for cache updates.

### 6. Access restrictions

Environment-based restrictions on which spaces and boards the AI can access — essential for multi-team environments where not all data should be exposed.

### 7. MCP resources and prompts

Built-in MCP resources provide instant access to workspace structure (spaces, boards) without tool calls. Prompt templates guide common workflows: creating cards, generating time reports, reviewing boards.

### 8. Standard configuration

Environment variables with schema validation at startup. Invalid configuration produces a descriptive error. Supports arbitrary base URLs for on-premise installations.

### 9. Minimal footprint

2 runtime dependencies, native fetch. Fast install, minimal attack surface, instant startup.

### 10. Advanced search

15+ search filters: title, owner, board, column, tags, dates, card type, completion status, archive exclusion, and more.

## Strengths

| Advantage | Details |
|---|---|
| Domain coverage | Time tracking, checklists, attachments, custom fields, card types, user roles |
| Tool count balance | 41 tools covering the full card lifecycle |
| Retry + idempotency | Server errors, network failures, and duplicate prevention |
| Access restrictions | Space/board whitelist |
| Smart caching | Instant responses with background refresh |
| Crash protection | Unhandled error recovery |
| MCP resources and prompts | Built-in workspace data and workflow templates |
| Minimal dependencies | 2 runtime dependencies, native fetch |
| On-premise support | Arbitrary URL, not locked to specific domains |
| Extended search | 15+ filter parameters |
| Structured logging | Configurable log levels for debugging |
| Actionable errors | Error messages include hints on what to do next |
