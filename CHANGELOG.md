# Changelog

## [0.1.2] - 2026-04-08 — dogfooding round: textFormat, URL fix, hint polish

Fixes found by running the published `kaiten-mcp@0.1.1` end-to-end as a real student would: the test session created a card via MCP, opened it in the Kaiten browser UI, and visually verified every operation. Three real bugs surfaced.

### Fixed

#### `description` and comment HTML showed up as literal angle brackets in the UI

Root cause: Kaiten's UI renders `description` and comment bodies as **markdown by default**. When the LLM sent HTML (the previous tool description literally said "Card description (HTML)"), Kaiten stored it verbatim and the UI rendered the angle brackets as plain text.

Verified live with 5 curl probes against `37controlseeing.kaiten.ru`:
- pure markdown without `text_format_type_id` → renders correctly
- HTML without `text_format_type_id` → broken (literal text in UI)
- HTML with `text_format_type_id: 2` → Kaiten parses HTML, normalizes to markdown for storage, UI renders correctly
- comment HTML with undocumented `type: 2` in request body → works (Kaiten accepts the field even though `docs/api/card-comments/add-comment.md` doesn't list it)
- comment HTML without `type` → broken

Fix:
- New `textFormat` enum parameter on `kaiten_create_card`, `kaiten_update_card`, `kaiten_create_comment`, `kaiten_update_comment` (`'markdown' | 'html' | 'jira_wiki'` for cards; `'markdown' | 'html'` for comments).
- Maps to `text_format_type_id` (cards) or `type` (comments) in the API request body.
- New shared helpers `textFormatCard` / `textFormatComment` and `textFormatCardId` / `textFormatCommentId` in `src/utils/schemas.ts`.
- `description` and `text` field descriptions rewritten — no more lying "(HTML)" labels. Now they say "Markdown by default — pass `textFormat: 'html'` if you're sending HTML."
- `update_card` / `update_comment` `requireSomeFields` checks now ignore a lone `textFormat` so passing it without the actual `description` / `text` doesn't pass the empty-body guard.

#### `url` field on every simplified card was `https://<host>/space//card/<id>` (double-slash)

Root cause: `simplifyCard.cardUrl()` constructed the URL from `card.space_id`, which Kaiten's `GET /cards/{id}` response **does not include** (verified `docs/api/cards/retrieve-card.md`). The `?? ""` fallback produced `/space//card/<id>` for every card, every list, every response — for the entire 0.1.0 + 0.1.1 lifetime.

Fix: use the short form `${baseUrl}/${card.id}`. Kaiten redirects it server-side to the canonical `/space/<space_id>/card/<id>`. Verified live during the dogfooding session — `https://host/63258149` → opens card 63258149 in the right space.

#### Recovery hint for `/cards/{id}` 4xx suggested `kaiten_get_card` after it just failed

The `RECOVERY_TOOLS` map for the bare `/cards` pattern recommended `kaiten_search_cards or kaiten_get_card`. The most common caller of this branch is `kaiten_get_card` itself failing — re-suggesting it doesn't help. Removed `kaiten_get_card` from that hint string. `kaiten_search_cards` is the only sensible recovery for "this card ID is wrong, look up the right one."

### Documentation

- README + docs/README.ru.md: new "Finding IDs from the browser URL" subsection. The student can copy IDs straight from the Kaiten address bar without dev tools — `/space/<id>`, `/boards/<id>`, `/card/<id>`. Maps directly to the env vars they need.
- README + docs/README.ru.md: env vars table now bold-highlights that **only `KAITEN_API_TOKEN` and `KAITEN_URL` are required**; expanded the `KAITEN_DEFAULT_SPACE_ID` description to make clear it's an optimization, not a requirement.
- README + docs/README.ru.md: two new entries in the Kaiten quirks section — the markdown-by-default behavior, and the workspace-tag delete API gap (Kaiten's `/tags` endpoint has no DELETE — `kaiten_remove_tag` only detaches from a card, orphan workspace tags can only be cleaned via the admin UI).

### Live verified

Every fix in this release was verified against the running 37controlseeing.kaiten.ru workspace via Playwright + curl during the dogfooding session — see the corresponding probe screenshots `live-test-*.png` and `probe-*.png`.

## [0.1.1] - 2026-04-08 — serverInfo identity fix

### Fixed

- `src/index.ts`: the `McpServer` instance was hardcoded with `name: "mcp-kaiten"` and `version: "1.0.2"` (leftover from upstream). MCP clients log this in `serverInfo` during the initialize handshake, so the published `kaiten-mcp@0.1.0` was reporting itself as `mcp-kaiten 1.0.2` to clients. Corrected to `name: "kaiten-mcp"` and `version: "0.1.1"`.

No other code changes — same 63 tools, same behavior, just the identity string the server sends in its handshake response.

## [0.1.0] - 2026-04-08 — Initial release as `kaiten-mcp`

First release of the fork on npm under the name `kaiten-mcp`. Forked from [iamtemazhe/mcp-kaiten](https://github.com/iamtemazhe/mcp-kaiten) at v1.1.0. Versioning starts fresh from `0.1.0` to signal that this is an independent codebase, not a drop-in replacement of upstream.

### Tool count: 41 → 63 (22 net new across Wave 1–5)

### Wave 1 — schema repairs (6 critical FAIL fixes)

- `kaiten_list_custom_properties`: corrected endpoint to `/company/custom-properties`
- `kaiten_list_tags` → renamed to `kaiten_list_card_tags(cardId)`, hits `/cards/{id}/tags`
- `kaiten_update_card.size:N`: legacy field replaced with `sizeText` (sent as `size_text`); removed-field guidance via friendly error
- `kaiten_update_card.state:N`: removed (state is computed from `column.type`); removed-field guidance points to `columnId`
- `kaiten_update_card.ownerId:null`: schema now `z.coerce.number().int().positive().optional()` — owner can only be re-assigned, not cleared
- `kaiten_get_space` / `kaiten_get_board` `verbosity=max`: now returns full fields plus inline columns/lanes for boards

### Wave 2 — author enrichment, removed-field guidance, boolean coercion

- `enrichAuthor()` helper in `simplify.ts`: comment/timelog responses now include `author_name` filled in client-side from `usersCache.getOrFetch("current")` when `author_id === currentUser.id`. Parallel fetch via `Promise.all`.
- `removedField()` helper in `schemas.ts` via `z.any().superRefine()`: keeps `size`/`state` in the schema but throws an explanatory error pointing to `sizeText`/`columnId`.
- Handler-level guard throws an explanatory error on empty `update_card` body before sending the API request.
- `boolish = z.preprocess(coerceBool, z.boolean())`: replaces all 11 `z.boolean()` usages in `cards.ts` and `checklists.ts`. Needed because `z.coerce.boolean()` is broken (`Boolean("false") === true`).

### Wave 3 — file metadata

- `simplifyFile`: was reading the non-existent field `f.content_type`; corrected to `f.mime_type`. Even `mime_type` is always null for regular uploads (Kaiten doesn't parse multipart Content-Type), so a `mimeFromName()` fallback was added with a 20-extension `EXT_TO_MIME` map.
- `simplifyFile` at `verbosity=normal`/`max` now returns `source` (decoded enum), `uid`, `thumbnail_url`, `card_cover`, `external`, `comment_id`, `sort_order`.

### Wave 4 — UX/coverage wave (12 net new tools)

Schema/helper foundation, cross-resource preflight, response simplification ladder, and 7 new tools across the cards and structure surface.

- **PR 4.1 — schema helpers:** `positiveId`, `optionalPositiveId`, `isoDate`, `optionalIsoDate`, `isoDateTime`, `optionalIsoDateTime`, `requireSomeFields` applied uniformly across every handler.
- **PR 4.5 — context-aware error hints:** `client.ts::hint()` rewritten with a `RECOVERY_TOOLS` map (~22 URL→tool patterns). Errors now include a recovery suggestion ("404 on `/cards/{id}` → try `kaiten_search_cards`").
- **PR 4.6 — verbosity=max strict-superset ladder:** for 7 entity types (user, timelog, column, lane, space, checklist item, card type), `max` is now a strict superset of `normal`. `simplifyColumn(col, v, boardId?)` signature change.
- **PR 4.7 — cross-resource preflight:** `assertChildBelongsToParent` in `src/utils/preflight.ts` with a `fetchPool` callback pattern. Applied to 9 mutating tools — closes a class of silent cross-resource bugs.
- **PR 4.10 — `update_card.properties`:** new field for setting custom property values inline.
- **PR 4.11 — `kaiten_delete_checklist_item`** (new tool)
- **PR 4.12 — `kaiten_list_workspace_tags`** (new tool — distinct from card-scoped `list_card_tags`)
- **PR 4.13 — card members** (new family, 4 tools): `kaiten_list_card_members`, `kaiten_add_card_member`, `kaiten_remove_card_member`, `kaiten_set_card_responsible`. Reuses `simplifyUser` + preflight.
- **PR 4.14 — card blockers** (new family, 4 tools): `kaiten_list_card_blockers`, `kaiten_add_card_blocker`, `kaiten_update_card_blocker`, `kaiten_release_card_blocker`. Critical Kaiten quirk discovered live: `PATCH /cards/{id}/blockers/{id}` silently strips `released`; `DELETE` actually flips `released:true` and keeps the row in the list endpoint (no hard-delete API). Tool is named `release_card_blocker`, `destructiveHint:false`, description explicitly explains the soft-release semantics.
- **PR 4.15a — `kaiten_rename_checklist`** (new tool)
- **PR 4.15b — `kaiten_list_space_users`** (new tool)
- **CC-11 — rename:** `kaiten_get_user_roles` → `kaiten_list_company_roles` (hard rename, no alias)

### Wave 5 — coverage extension (10 net new tools)

The remaining MISSING-useful endpoints from the API coverage audit. Single teammate, 7 atomic commits.

- **`src/tools/externalLinks.ts` (new module, 4 tools):** `kaiten_list_card_external_links`, `kaiten_add_card_external_link`, `kaiten_update_card_external_link`, `kaiten_remove_card_external_link`. Inline `simplifyExternalLink` + preflight on update/remove. Quirk: POST response lacks `card_id`/`external_link_id` (only in GET list), uses `?? null`. DELETE is a true hard-delete (asymmetric with blocker soft-release).
- **`src/tools/sprints.ts` (new module, 2 tools):** `kaiten_list_sprints`, `kaiten_get_sprint`. Inline `simplifySprint` + `simplifySprintSummary`. At `verbosity=max` the sprint summary uses `simplifyCard(c, "normal")` (NOT `max`) to prevent exploding for sprints with many cards. Quirk: non-existent sprint returns 403, not 404.
- **`kaiten_get_card_location_history`** (extends `cards.ts`): inline `simplifyLocationHistory` reuses `simplifyUser` for `max`. Quirk: `id` field is a STRING (not number); preserved as-is to avoid Number precision loss for IDs > 2^53.
- **`kaiten_list_custom_property_select_values`** (extends `customFields.ts`): inline `simplifySelectValue`. Schema-by-docs (test workspace has no custom properties; 404 path verified).
- **`kaiten_get_timesheet`** (extends `timelogs.ts`): required `from`/`to` (`isoDate`), 7 optional array filters joined as comma-separated strings. Empty arrays are skipped from the query string entirely (Kaiten 400s on `card_ids=`). Reuses `simplifyTimelogList`/`enrichAuthor`/`fetchCurrentUser` from Wave 4.
- **`kaiten_list_subcolumns`** (extends `spaces.ts`): reuses `simplifyColumn` (subcolumn = column with parent `column_id`).

### Reliability and DX

- 100% Wave 4 + Wave 5 regression coverage against `test-tracker.md`: 61/63 PASS, 2 PARTIAL (workspace fixture-bound: `list_custom_property_select_values` and `get_sprint`).
- All Wave 4 + Wave 5 quirks documented in tool descriptions so the LLM consumer can act accordingly.

---

## [1.1.0] - 2026-03-21

### Added
- **Checklists:** create, view, delete checklists; add and update checklist items
- **Tags:** list workspace tags, add and remove tags from cards
- **Subtasks:** list, attach, and detach child cards
- **Files:** list, upload, and delete card attachments
- **Custom fields:** view custom properties per space
- **MCP resources:** instant access to workspace spaces and boards without tool calls
- **MCP prompts:** guided workflows for card creation, time reports, and board overviews

### Fixed
- Adding tags to cards now works correctly
- File upload to cards now works correctly

### Changed
- Tool descriptions now guide the AI on where to find required IDs and allowed values
- Detaching a subtask is no longer flagged as a destructive operation

## [1.0.2] - 2026-03-21

### Fixed
- Card listing in spaces and boards now sorted correctly

### Changed
- Card types are now listed globally, no board ID required
- Condition filter supports "all" option for active, archived, or both

## [1.0.1] - 2026-03-20

### Fixed
- Card creation, search, and listing endpoints corrected
- Time-log creation now correctly requires a role
- Time-log deletion works reliably

### Added
- Russian README

## [1.0.0] - 2026-03-20

### Initial Release

- **Cards:** get, search, list by space/board, create, update, delete
- **Comments:** list, create, update, delete
- **Time Logs:** get by user/card, create, update, delete
- **Spaces & Boards:** list spaces/boards/columns/lanes/card types, get space, get board
- **Users:** current user, list users, user roles
- Search with 15+ filters, dates, pagination
- 4 verbosity levels to control response size
- Automatic retries on network errors and rate limits
- Reference data caching for faster responses
- Large response truncation to protect AI context
