# Changelog

## [0.1.7] - 2026-04-09 — LLM_GUIDE.md shipped with npm package

Added `LLM_GUIDE.md` — a comprehensive guide designed to be loaded into LLM context before the first Kaiten tool call. Covers architecture, workflow patterns, API quirks, error recovery, and tool selection. Students add one line to their CLAUDE.md:

```
Read ./node_modules/kaiten-mcp/LLM_GUIDE.md before working with Kaiten.
```

## [0.1.6] - 2026-04-09 — three UX fixes from live demo workflow

### Fixed

#### `get_card(includeChildren=true)` returned `board_title:null` / `column_title:null` for children

Root cause: double-simplify bug. The handler first ran `simplifyList(children, simplifyCard, v)` which stripped nested `board`/`column` objects to flat `board_title`/`column_title` fields. Then `simplifyCard(card, v)` on the parent ran `cardFns.min(ch)` on the already-simplified children — but `cardFns.min` reads `nested(ch, "board")?.title`, and the nested object no longer existed. Fix: inject raw children into `card.children` and let the single `simplifyCard(card, v)` pass handle everything. `list_subtasks` was never affected because it simplifies in one pass.

#### `list_card_blockers` returned `blocker_card_title:null` for every blocker

Kaiten's `GET /cards/{id}/blockers` endpoint always returns `blocker_card_title:null` even when `blocker_card_id` points to an existing card. The handler now hydrates titles by parallel-fetching each unique `blocker_card_id` and merging the title before simplification. If a blocking card was deleted or is inaccessible, the title remains null gracefully.

#### `get_card.members` was a flat string array, losing member vs responsible distinction

`simplifyCard.normal/max` mapped members to `string[]` (`m.full_name ?? m.username`), discarding the `type` field (1=member, 2=responsible). Now returns `{id, name, type}[]` so the LLM can distinguish roles without a second `kaiten_list_card_members` call.

## [0.1.5] - 2026-04-09 — search_cards silent empty result on cross-space boardId

A live full-workflow demo against a brand-new space (`MCP Demo Space`, space 763607) caught a critical silent fail in `kaiten_search_cards`: passing a `boardId` from a non-default space silently returned `[]`, even though `kaiten_get_board_cards` with the same boardId returned the cards as expected.

### Fixed

#### `search_cards(boardId=…)` returns silent `[]` when boardId is in a non-default space

Root cause in `src/utils/queryBuilder.ts:52`:

```ts
["space_id", p.spaceId ?? getDefaultSpaceId()],
```

`buildSearchQuery` always layered `KAITEN_DEFAULT_SPACE_ID` on top of any request that did not pass an explicit `spaceId`. When the caller passed only `boardId` (the natural way to scope a search to one board), the resulting query became `board_id=X + space_id=Y` where X lived in a different space — Kaiten silently returned `[]`. No error, no warning.

Reproduced live: `search_cards(boardId=1729535)` → `[]`, `get_board_cards(boardId=1729535)` → 4 cards. Both pointed at the same board on the same workspace.

Fix: explicit `boardId` implicitly identifies a single space, so the queryBuilder no longer layers `KAITEN_DEFAULT_SPACE_ID` on top of it. The default space is only used as a fallback when neither `boardId` nor `spaceId` is given. If the caller really wants both, both still get sent.

#### `search_fields=title` was sent unconditionally, even without a query

Same file. The hardcoded `search_fields: "title"` was added to every search request, regardless of whether a `query` parameter was actually present. When a search filter was set without a `query`, this risked Kaiten filtering down to zero matches because of an empty title search. Fixed: `search_fields` is now only included when `query` is also non-empty.

## [0.1.4] - 2026-04-09 — global data: URI sanitizer in HTTP client

A live re-test of `0.1.3` confirmed that the avatar PNG bloat was still leaking via two channels: `verbosity: "raw"` (by design unfiltered) and any simplifier path that passed a nested user object through verbatim (e.g. `simplifyCardType.max.author`). For an LLM consumer the inline `data:image/png;base64,...` payload is **never** useful — it just inflates the context — so the fix is now applied at the layer where the response enters the process, not per-simplifier.

### Fixed

#### `data:` URI blobs leak into responses regardless of verbosity / simplifier coverage

`0.1.3` stripped `avatar_initials_url` only inside `simplifyUser.max`. That left two leaks:
1. `verbosity: "raw"` returned the un-simplified Kaiten payload, so every nested `owner` / `author` / `members[]` object still carried the ~1.4 KB base64 PNG.
2. Any simplifier that re-emitted a raw user sub-object instead of routing it through `simplifyUser` (verified `simplify.ts:603` `simplifyCardType.max.author = t.author ?? null`).

Fix — `src/client.ts`:
- New `stripDataUriBlobs(obj)` recursive sanitizer that walks any plain object/array and removes any field whose value is a string starting with `data:` AND longer than 200 characters. The length threshold protects legitimate short user content (e.g. someone literally pastes `data:text/plain,hi` into a description) from being eaten.
- Applied inside `request<T>` immediately after `resp.json()`, before the result is returned to any tool handler. Also applied in `uploadFile<T>` for parity.
- This means **all verbosities are clean**, including `raw`. Rationale: `raw` is meant to expose raw API *fields*, not raw inline blobs the LLM cannot use. If a caller actually wants the binary, `curl` to the Kaiten REST API directly.

Net effect: zero base64 PNG payloads in any MCP response, no per-simplifier maintenance burden. Verified live by re-running the previous PNG-bloat repros from the deep dogfood — a `kaiten_get_card_location_history(verbosity=max)` response that previously returned the same 1.4 KB blob 50× now returns an `author` object with only the metadata fields.

## [0.1.3] - 2026-04-09 — second dogfooding round: dueDate visibility, condition filter, avatar bloat

A second deeper Playwright + UI dogfood pass against the published `kaiten-mcp@0.1.2` surfaced two real silent bugs and three UX issues that 0.1.0/0.1.1/0.1.2 had been carrying. All five are fixed in this release.

### Fixed

#### `dueDate` was silently invisible in the Kaiten UI

Setting `dueDate` via `kaiten_create_card` / `kaiten_update_card` persisted `due_date` in the API (verified via raw GET) but the Kaiten card UI showed only the empty "Срок" label with NO value. Root cause: `docs/api/cards/update-card.md:32` documents an additional field `due_date_time_present` (boolean). Empirically the Kaiten UI hides the deadline entirely when the flag is false, even if `due_date` is populated. The 0.1.0/0.1.1/0.1.2 schemas did not expose this field, so the default `false` was always sent and the UI always hid the date.

Fix:
- New `dueDateTimePresent` optional `boolish` parameter on `kaiten_create_card` and `kaiten_update_card`.
- New helper `dueDateTimePresentDefault(dueDate, flag)` in `src/tools/cards.ts` that auto-derives the flag: when the caller passes `dueDate` without explicitly setting `dueDateTimePresent`, the flag defaults to `true` so the date appears in the UI. Pass `dueDateTimePresent: false` explicitly only if you intentionally want a hidden deadline.
- `dueDate` field descriptions on both tools updated to mention the auto-flag behavior.
- `requireSomeFields` for `update_card` now lists `dueDateTimePresent` in the allowed-fields error message.

#### `condition=3` filter returned deleted cards instead of "all"

`src/utils/schemas.ts:203 conditionSchema` was documented as `1=active, 2=archived, 3=all` and capped with `.max(3)`. But `docs/api/cards/retrieve-card-list.md:57` explicitly says the filter accepts only `1 - on board, 2 - archived`. The value `3` exists in Kaiten as a RESPONSE enum meaning "deleted" (`retrieve-card-list.md:325`); passing it as a filter returns ONLY deleted cards, not all cards. Verified live 2026-04-09: `kaiten_get_board_cards(1727463, condition=3)` returned `[]` while `condition=1` returned the live card.

Fix:
- `conditionSchema` capped at `.max(2)` (not 3).
- Description rewritten: "1=live (default), 2=archived. Kaiten does not support a filter for both in one call — omit (defaults to live) or query twice and merge."
- `kaiten_search_cards` description updated to remove the wrong `condition=3 (both)` claim.

#### `avatar_initials_url` base64 PNG bloat in `simplifyUser.max`

Each Kaiten user object carries a ~1.4 KB inline base64 PNG generated from the user's initials. The previous `simplifyUser.max` ladder included it, so it appeared in: `kaiten_list_users`, `kaiten_get_current_user`, `kaiten_list_space_users`, AND nested under `author` inside `kaiten_list_card_types`, `kaiten_get_card_location_history`, etc. A card with 50 location-history entries at `verbosity=max` was returning 50× the same base64 PNG — pure waste for an LLM consumer that cannot decode PNG anyway.

Fix:
- `avatar_initials_url` removed from `simplifyUser.max` in `src/utils/simplify.ts`. Real `avatar_url` is still included. Callers that need the data URL can use `verbosity=raw`.

### Documentation

#### `textFormat='jira_wiki'` partial-support warning on cards

Live test 2026-04-09 showed Kaiten's jira_wiki parser is partially broken:
- `_italic_` does not render as `<em>` (stays literal in `<p>`).
- Inside `{code:python}` blocks, underscores get mangled to asterisks: `def jira_wiki_test()` rendered as `def jira*wiki*test()`.

This is a Kaiten-side bug, not something the MCP can fix, but the tool should warn the LLM. The `textFormatCard` enum description in `src/utils/schemas.ts` now ends with: "WARNING: 'jira_wiki' support in Kaiten is partial — italic `_text_` does not render and underscores inside `{code}` blocks get mangled to asterisks. Prefer 'markdown' or 'html' for new content."

#### Comment markdown does NOT support headings

Live test 2026-04-09 confirmed that Kaiten's comment markdown parser is a CommonMark subset that excludes ATX headings. `### Header` in a comment renders as literal text inside a `<p>` tag. Card description markdown DOES support headings — the limitation is comment-specific, and was undocumented anywhere.

Fix:
- `kaiten_create_comment` and `kaiten_update_comment` tool descriptions now contain a "QUIRK" paragraph explaining the limitation.
- The `text` parameter description on both tools also mentions it explicitly so the LLM sees the warning at the parameter level.

### Live verified

All five fixes were verified against the running 37controlseeing.kaiten.ru workspace via Playwright + MCP during the deep-dogfood-2 session.

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
