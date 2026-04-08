# Why kaiten-mcp exists

## Background

`kaiten-mcp` is a fork of [iamtemazhe/mcp-kaiten](https://github.com/iamtemazhe/mcp-kaiten) (originally by Artem Zheleznov). The upstream project provided a solid foundation — 41 tools covering the core card lifecycle — but in real-world use against a production Kaiten workspace, several gaps and rough edges surfaced. This fork closes them.

The original npm name `mcp-kaiten` is still owned by the upstream author (currently at v1.1.0). We publish this fork under a separate name, `kaiten-mcp`, starting from version 0.1.0 — a fresh start that signals "this is a different, independent codebase, not a drop-in replacement."

## What this fork adds

Five waves of work, fully merged.

### Wave 1 — schema repairs

Six critical FAIL-class bugs in the original schemas, all caught against `docs/api/`:

- `list_custom_properties` was hitting the wrong endpoint
- `list_tags` couldn't list tags on a card (the endpoint requires a card scope)
- `update_card.size:N` was silently rejected by the API
- `update_card.state:N` was a no-op (state is computed, not stored)
- `update_card.ownerId:null` was rejected with a confusing 400
- `verbosity=max` for `get_space` / `get_board` was missing inline columns/lanes

### Wave 2 — author enrichment, removed-field guidance, boolean coercion

- Comment and timelog responses now include `author_name` even when the API returns only `author_id`. The current user is fetched in parallel and joined client-side.
- `update_card.size:N` and `state:N` got friendly explanatory errors with pointers to the working alternatives (`sizeText`, `columnId`).
- Boolean parameters across 11 tools now accept `"true"` / `"false"` strings, not just real booleans (because `z.coerce.boolean()` is broken — `Boolean("false") === true`).

### Wave 3 — file metadata

`list_files` and `upload_file` were returning `content_type:null` for every file. Two root causes: (1) the simplifier was reading a non-existent field name, and (2) Kaiten doesn't actually populate the field for regular uploads. Fixed by reading the correct API field plus adding a filename-extension fallback for the 20 most common file types.

### Wave 4 — UX/coverage wave (12 net new tools)

Big quality push, executed across four phases and eight parallel teammates in worktrees:

- **Schema helper library:** `positiveId`, `optionalPositiveId`, `isoDate`, `requireSomeFields` etc., applied uniformly across every handler.
- **Context-aware error hints:** error messages from the API now suggest a related read tool ("404 on `/cards/{id}` → try `kaiten_search_cards`"), based on a 22-pattern URL→tool map.
- **`verbosity=max` strict-superset ladder:** for 7 entity types (user, timelog, column, lane, space, checklist item, card type), `max` is now a strict superset of `normal`, which is a strict superset of `min`.
- **Cross-resource preflight:** 9 mutating tools that take both a parent ID and a child ID now verify the child belongs to the parent before sending the mutation. Closes a class of silent cross-resource bugs.
- **New tools:** `list_workspace_tags`, `delete_checklist_item`, `rename_checklist`, `list_space_users`, `list_card_members` + `add/remove_card_member` + `set_card_responsible`, `list_card_blockers` + `add/update/release_card_blocker`. Plus `update_card.properties` for setting custom-property values inline.
- **Live-discovered Kaiten quirk:** `DELETE` on a blocker is a soft release (flips `released:true` and keeps the row), not a hard delete. The tool is named `release_card_blocker` and `destructiveHint:false` to make this explicit.

### Wave 5 — coverage extension (10 net new tools)

The remaining MISSING-useful endpoints from the API coverage audit:

- **Card external links** (4 tools): list / add / update / remove. Lets the LLM link a Kaiten card to a Jira ticket or GitHub issue without polluting the description field.
- **Sprints** (2 tools): list / get summary. Read-only.
- **`get_card_location_history`**: audit trail showing how long the card sat in each column.
- **`list_custom_property_select_values`**: lets the LLM safely set values for `select` / `multi_select` custom properties (without this, Wave 4's `update_card.properties` is unsafe).
- **`get_timesheet`**: global timesheet across users/spaces/boards for "who logged how much this week" queries.
- **`list_subcolumns`**: completes the structural view for boards with sub-columns.

Five additional Kaiten quirks were discovered and worked around:

- `location_history.id` is a string, not a number — preserved as-is to avoid precision loss.
- `GET /sprints/{id}` returns 403 (not 404) for non-existent sprints.
- `POST /cards/{id}/external-links` response lacks `card_id` and `external_link_id` (they only appear in the GET list endpoint).
- `GET /time-logs?card_ids=` (empty value) returns 400 — empty arrays are skipped from the query string entirely.
- `DELETE /cards/{id}/external-links/{id}` is a true hard-delete, asymmetric with the blocker soft-release.

## What this fork keeps from upstream

Everything that already worked: the verbosity ladder, the response simplification pipeline, the retry/idempotency layer, the resource and prompt registrations, the cache layer, the env-var configuration, the build setup. Wave 1–5 is additive — schemas got tightened, tools got added, edge cases got handled. None of the upstream tool descriptions or response shapes were broken.

## When to use this fork instead of upstream

- You hit one of the bugs Wave 1–3 fixes (custom properties, tag listing, size/state updates, file metadata).
- You need a tool that exists in Wave 4 or 5 but not upstream (members, blockers, external links, sprints, location history, timesheet, custom-property select values, subcolumns, workspace tag listing, checklist rename / item delete, space user listing).
- You want preflight safety on cross-resource mutations.
- You want context-aware error hints rather than raw API errors.

## When upstream is fine

- You only need the basic card lifecycle (CRUD + comments + time logs) and don't touch the affected areas.
- You're okay debugging silent fails on size/state/owner updates yourself.
- You don't use checklists, tags, files, or custom properties beyond what Wave 0 already shipped.

## Credit

The original `mcp-kaiten` codebase, the verbosity model, the simplification approach, the cache layer, the resource and prompt patterns, and the entire build/runtime skeleton are the work of [Artem Zheleznov (iamtemazhe)](https://github.com/iamtemazhe). This fork is layered on top.
