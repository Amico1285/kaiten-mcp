import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get, post, patch, del } from "../client.js";
import {
  jsonResult, textResult, handleTool,
} from "../utils/errors.js";
import {
  type Obj, optionalInt, paginationSchema,
  conditionSchema, buildOptionalBody,
  boolish, boolishWithDefault, removedField,
  positiveId, optionalPositiveId,
  optionalIsoDateTime, requireSomeFields,
} from "../utils/schemas.js";
import {
  simplifyCard, simplifyList,
  simplifyUser,
  verbositySchema,
  asV,
  type Verbosity,
} from "../utils/simplify.js";
import { buildSearchQuery } from "../utils/queryBuilder.js";

// Inline simplify helper for the location-history endpoint
// (same pattern as blockers.ts — keeps src/utils/simplify.ts
// untouched). CRITICAL: the live probe on 2026-04-08 showed
// that `id` on this endpoint is a STRING (e.g.
// "528420192"), not a number — unique among Kaiten list
// endpoints. Leave it as-is; converting to Number would
// lose precision for large ids (>2^53).
function simplifyLocationHistory(
  h: Obj, v: Verbosity,
): Obj {
  if (v === "raw") return h;
  const author = (h.author && typeof h.author === "object")
    ? h.author as Obj
    : undefined;
  const min: Obj = {
    id: h.id, // string, not number — do NOT convert
    board_id: h.board_id,
    column_id: h.column_id,
    lane_id: h.lane_id,
    changed: h.changed,
    condition: h.condition,
  };
  if (v === "min") return min;
  const normal: Obj = {
    ...min,
    subcolumn_id: h.subcolumn_id ?? null,
    sprint_id: h.sprint_id ?? null,
    author_id: h.author_id,
    author_name: author?.full_name ?? null,
  };
  if (v === "normal") return normal;
  return {
    ...normal,
    card_id: h.card_id,
    author: author ? simplifyUser(author, "max") : null,
  };
}

export function registerCardTools(
  server: McpServer,
): void {
  server.registerTool(
    "kaiten_get_card",
    {
      title: "Get Card",
      description:
        "Get a single card by ID. Use verbosity=max for full "
        + "detail (default is min, which returns 9 core fields). "
        + "Set includeChildren=true to also fetch child cards. "
        + "Resolve cardId via kaiten_search_cards or "
        + "kaiten_get_board_cards. Returns: a single card object "
        + "(simplified per verbosity).",
      inputSchema: {
        cardId: positiveId(
          "Card ID (from kaiten_search_cards or "
          + "kaiten_get_board_cards)",
        ),
        includeChildren: boolishWithDefault(false)
          .describe("Also fetch child cards"),
        verbosity: verbositySchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({
      cardId, includeChildren, verbosity,
    }) => {
      const v = asV(verbosity);

      if (includeChildren) {
        const [card, children] = await Promise.all([
          get<Obj>(`/cards/${cardId}`),
          get(`/cards/${cardId}/children`)
            .catch(() => []),
        ]);
        card.children = simplifyList(
          children, simplifyCard, v,
        );
        return jsonResult(simplifyCard(card, v));
      }

      const card = await get<Obj>(
        `/cards/${cardId}`,
      );
      return jsonResult(simplifyCard(card, v));
    }),
  );

  server.registerTool(
    "kaiten_search_cards",
    {
      title: "Search Cards",
      description:
        "Search cards with filters and pagination. Pass boardId "
        + "(from kaiten_list_boards) or spaceId (from "
        + "kaiten_list_spaces) to limit scope. The `query` "
        + "parameter performs a substring match against card "
        + "titles (server searches the `title` field only). "
        + "The `condition` parameter is a magic number: 1=active "
        + "(default), 2=archived only, 3=all (both). Use "
        + "kaiten_get_card for full detail on a specific card. "
        + "Returns: array of cards (simplified per verbosity).",
      inputSchema: {
      query: z.string().optional().describe(
        "Substring match against card titles",
      ),
      boardId: optionalPositiveId(
        "Filter by board ID (from kaiten_list_boards)",
      ),
      spaceId: optionalPositiveId(
        "Filter by space ID (from kaiten_list_spaces; "
        + "uses KAITEN_DEFAULT_SPACE_ID if omitted)",
      ),
      columnId: optionalPositiveId(
        "Filter by column ID (from kaiten_list_columns)",
      ),
      laneId: optionalPositiveId(
        "Filter by lane ID (from kaiten_list_lanes)",
      ),
      ownerId: optionalPositiveId(
        "Filter by owner user ID (from kaiten_list_users)",
      ),
      typeId: optionalPositiveId(
        "Filter by card type ID (from kaiten_list_card_types)",
      ),
      state: optionalInt(
        "Card state: draft|queued|in_progress|done",
      ),
      condition: conditionSchema,
      asap: boolish.optional().describe(
        "Filter urgent cards",
      ),
      archived: boolish.optional().describe(
        "Filter archived cards",
      ),
      overdue: boolish.optional().describe(
        "Filter overdue cards",
      ),
      withDueDate: boolish.optional().describe(
        "Filter cards with due date",
      ),
      createdBefore: optionalIsoDateTime(
        "Cards created before this ISO 8601 timestamp "
        + "(YYYY-MM-DD or full datetime)",
      ),
      createdAfter: optionalIsoDateTime(
        "Cards created after this ISO 8601 timestamp "
        + "(YYYY-MM-DD or full datetime)",
      ),
      updatedBefore: optionalIsoDateTime(
        "Cards last updated before this ISO 8601 timestamp "
        + "(YYYY-MM-DD or full datetime)",
      ),
      updatedAfter: optionalIsoDateTime(
        "Cards last updated after this ISO 8601 timestamp "
        + "(YYYY-MM-DD or full datetime)",
      ),
      dueDateBefore: optionalIsoDateTime(
        "Cards with due date before this ISO 8601 timestamp "
        + "(YYYY-MM-DD or full datetime)",
      ),
      dueDateAfter: optionalIsoDateTime(
        "Cards with due date after this ISO 8601 timestamp "
        + "(YYYY-MM-DD or full datetime)",
      ),
      ownerIds: z.string().optional().describe(
        "Comma-separated owner IDs",
      ),
      memberIds: z.string().optional().describe(
        "Comma-separated member IDs",
      ),
      tagIds: z.string().optional().describe(
        "Comma-separated tag IDs",
      ),
      typeIds: z.string().optional().describe(
        "Comma-separated card type IDs",
      ),
      doneOnTime: boolish.optional().describe(
        "Filter by done on time",
      ),
      excludeArchived: boolish.optional()
        .describe("Exclude archived cards"),
      excludeCompleted: boolish.optional()
        .describe("Exclude completed cards"),
      sortBy: z.enum(
        ["created", "updated", "title"],
      )
        .default("created")
        .describe("Sort field"),
      sortDirection: z.enum(["asc", "desc"])
        .default("desc")
        .describe("Sort direction"),
      ...paginationSchema,
      verbosity: verbositySchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async (p) => {
      const v = asV(p.verbosity);
      const q = buildSearchQuery(p);

      const cards = await get("/cards", q);
      return jsonResult(
        simplifyList(cards, simplifyCard, v),
      );
    }),
  );

  const fetchCardsByScope = (
    scopeKey: string,
    scopeId: number,
    condition: number,
    limit: number,
    offset: number,
    verbosity: string,
  ) => {
    const v = asV(verbosity);
    return get("/cards", {
      [scopeKey]: String(scopeId),
      limit: String(limit),
      skip: String(offset),
      condition: String(condition),
      order_by: "created",
      order_direction: "desc",
    }).then((cards) =>
      jsonResult(simplifyList(cards, simplifyCard, v)),
    );
  };

  server.registerTool(
    "kaiten_get_space_cards",
    {
      title: "List Space Cards",
      description:
        "Recent cards in a space (newest first, no filters). "
        + "For filtered search use kaiten_search_cards.",
      inputSchema: {
        spaceId: positiveId(
          "Space ID (from kaiten_list_spaces)",
        ),
        condition: conditionSchema,
        ...paginationSchema,
        verbosity: verbositySchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({
      spaceId, condition, limit, offset, verbosity,
    }) => fetchCardsByScope(
      "space_id", spaceId,
      condition, limit, offset, verbosity,
    )),
  );

  server.registerTool(
    "kaiten_get_board_cards",
    {
      title: "List Board Cards",
      description:
        "Recent cards on a board (newest first, no filters). "
        + "For filtered search use kaiten_search_cards.",
      inputSchema: {
        boardId: positiveId(
          "Board ID (from kaiten_list_boards)",
        ),
        condition: conditionSchema,
        ...paginationSchema,
        verbosity: verbositySchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({
      boardId, condition, limit, offset, verbosity,
    }) => fetchCardsByScope(
      "board_id", boardId,
      condition, limit, offset, verbosity,
    )),
  );

  server.registerTool(
    "kaiten_create_card",
    {
      title: "Create Card",
      description:
        "Create card. Requires boardId (from kaiten_list_boards) "
        + "and columnId (from kaiten_list_columns). Optional: "
        + "laneId (kaiten_list_lanes), typeId "
        + "(kaiten_list_card_types), sizeText. ownerId must be a "
        + "positive integer (Kaiten requires every card to have "
        + "an owner). "
        + "NOTE: response in min/normal verbosity may show "
        + "`board_title:null` and `column_title:null` because "
        + "POST /cards returns a flat payload. Re-fetch via "
        + "kaiten_get_card to populate, or use verbosity=raw.",
      inputSchema: {
      boardId: positiveId(
        "Board ID (from kaiten_list_boards)",
      ),
      columnId: positiveId(
        "Column ID (from kaiten_list_columns)",
      ),
      title: z.string().min(1).max(500).describe(
        "Card title",
      ),
      laneId: optionalPositiveId(
        "Lane ID (from kaiten_list_lanes)",
      ),
      description: z.string().optional().describe(
        "Card description (HTML)",
      ),
      typeId: optionalPositiveId(
        "Card type ID (from kaiten_list_card_types)",
      ),
      sortOrder: optionalInt(
        "Sort order in column",
      ),
      sizeText: z.union([z.string(), z.coerce.number()])
        .optional()
        .describe(
          "Card size as text. Examples: '1', '5 SP', "
          + "'L', '3 M', 'XL'. Sent as `size_text` to API. "
          + "The numeric `size` field on a card is read-only "
          + "and computed from this text.",
        ),
      asap: boolish.optional().describe(
        "Mark as urgent",
      ),
      ownerId: optionalPositiveId(
        "Owner user ID (must be a positive integer). "
        + "Defaults to API caller if omitted.",
      ),
      dueDate: optionalIsoDateTime(
        "Due date in ISO 8601 (YYYY-MM-DD or full datetime)",
      ),
      verbosity: verbositySchema,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async (p) => {
      const v = asV(p.verbosity);
      const body = {
        board_id: p.boardId,
        column_id: p.columnId,
        title: p.title,
        ...buildOptionalBody([
          ["lane_id", p.laneId],
          ["description", p.description],
          ["type_id", p.typeId],
          ["sort_order", p.sortOrder],
          ["size_text", p.sizeText],
          ["asap", p.asap],
          ["owner_id", p.ownerId],
          ["due_date", p.dueDate],
        ]),
      };

      const card = await post<Obj>(
        "/cards", body,
      );
      return jsonResult(simplifyCard(card, v));
    }),
  );

  server.registerTool(
    "kaiten_update_card",
    {
      title: "Update Card",
      description:
        "Update card fields. For moves use "
        + "kaiten_list_columns, kaiten_list_lanes, "
        + "kaiten_list_boards IDs. To change state — move "
        + "the card via columnId (Kaiten state is computed "
        + "from column.type, not settable directly). "
        + "To change size — use sizeText (the numeric size "
        + "field on a card is read-only). "
        + "Set custom property values via the `properties` map "
        + "(see kaiten_list_custom_properties for IDs and "
        + "types). "
        + "NOTE: response in min/normal verbosity may show "
        + "`board_title:null` and `column_title:null` because "
        + "PATCH /cards/{id} returns a flat payload. Re-fetch "
        + "via kaiten_get_card to populate, or use "
        + "verbosity=raw.",
      inputSchema: {
      cardId: positiveId(
        "Card ID (from kaiten_search_cards or kaiten_get_card)",
      ),
      title: z.string().optional().describe(
        "New title",
      ),
      description: z.string().optional().describe(
        "New description (HTML)",
      ),
      columnId: optionalPositiveId(
        "Move to column ID (from kaiten_list_columns)",
      ),
      laneId: optionalPositiveId(
        "Move to lane ID (from kaiten_list_lanes)",
      ),
      boardId: optionalPositiveId(
        "Move to board ID (from kaiten_list_boards)",
      ),
      typeId: optionalPositiveId(
        "Change card type ID (from kaiten_list_card_types)",
      ),
      sizeText: z.union([z.string(), z.coerce.number()])
        .optional()
        .describe(
          "Card size as text. Examples: '1', '5 SP', "
          + "'L', '3 M', 'XL'. Sent as `size_text` to API. "
          + "The numeric `size` field on a card is read-only "
          + "and computed from this text.",
        ),
      // Legacy fields kept in the schema only so a friendly
      // error fires when a caller still passes them. Handler
      // never reads them.
      size: removedField(
        "'size' is read-only in Kaiten — pass `sizeText` "
        + "(e.g. '5 SP') and the numeric `size` will be "
        + "computed from it.",
      ),
      state: removedField(
        "'state' is computed from column.type, not settable "
        + "directly. To change it, move the card via "
        + "`columnId` (column type 1=queued, 2=in_progress, "
        + "3=done).",
      ),
      asap: boolish.optional().describe(
        "Mark as urgent",
      ),
      ownerId: optionalPositiveId(
        "Reassign owner to user ID (must be a positive "
        + "integer). Kaiten requires every card to have "
        + "an owner — cannot be unset, only reassigned.",
      ),
      dueDate: optionalIsoDateTime(
        "Due date in ISO 8601 (YYYY-MM-DD or full datetime)",
      ),
      properties: z.record(z.string(), z.unknown()).optional()
        .describe(
          "Map of custom property values keyed 'id_{propertyId}'. "
          + "Use kaiten_list_custom_properties to find property "
          + "IDs and their `type` (which determines the value "
          + "shape: string, number, date, select id, "
          + "multi_select ids[], user id, catalog uid, tree "
          + "uid, etc.). Pass null as a value to clear a "
          + "property. Example: "
          + "{\"id_574845\": \"my-value\", \"id_574850\": null}",
        ),
      verbosity: verbositySchema,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({
      cardId, verbosity, ...fields
    }) => {
      const v = asV(verbosity);
      const body = buildOptionalBody([
        ["title", fields.title],
        ["description", fields.description],
        ["column_id", fields.columnId],
        ["lane_id", fields.laneId],
        ["board_id", fields.boardId],
        ["type_id", fields.typeId],
        ["size_text", fields.sizeText],
        ["asap", fields.asap],
        ["owner_id", fields.ownerId],
        ["due_date", fields.dueDate],
        ["properties", fields.properties],
      ]);

      requireSomeFields(body, "kaiten_update_card", [
        "title", "description", "columnId", "laneId",
        "boardId", "typeId", "sizeText", "asap",
        "ownerId", "dueDate", "properties",
      ]);

      const card = await patch<Obj>(
        `/cards/${cardId}`, body,
      );
      return jsonResult(simplifyCard(card, v));
    }),
  );

  server.registerTool(
    "kaiten_delete_card",
    {
      title: "Delete Card",
      description:
        "Permanently delete a card (cannot be undone). "
        + "Resolve cardId via kaiten_search_cards or "
        + "kaiten_get_card. "
        + "NOTE: cards with logged time cannot be deleted "
        + "(Kaiten returns 400 'Card removing with logged time "
        + "not allowed'). Delete the timelogs first via "
        + "kaiten_delete_timelog.",
      inputSchema: {
        cardId: positiveId(
          "Card ID (from kaiten_search_cards or "
          + "kaiten_get_card)",
        ),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({ cardId }) => {
      await del(`/cards/${cardId}`);
      return textResult(
        `Card ${cardId} deleted`,
      );
    }),
  );

  server.registerTool(
    "kaiten_get_card_location_history",
    {
      title: "Get Card Location History",
      description:
        "Get the card movement history — every time the "
        + "card was moved between boards, columns, lanes, "
        + "or sprints, with a timestamp and the author who "
        + "performed the move. Useful for audit ('who moved "
        + "this card and when') and cycle-time analytics "
        + "('how long did this card sit in each column'). "
        + "Sorted newest-first by `changed`. NOTE: unlike "
        + "most Kaiten endpoints the history `id` field is "
        + "a STRING (not an integer) — treat it as an "
        + "opaque identifier. condition: 1=Active, "
        + "2=Archived, 3=Deleted. cardId from "
        + "kaiten_get_card or kaiten_search_cards.",
      inputSchema: {
        cardId: positiveId(
          "Card ID (from kaiten_search_cards or "
          + "kaiten_get_card)",
        ),
        verbosity: verbositySchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({ cardId, verbosity }) => {
      const v = asV(verbosity);
      const history = await get<Obj[]>(
        `/cards/${cardId}/location-history`,
      );
      return jsonResult(
        history.map((h) => simplifyLocationHistory(h, v)),
      );
    }),
  );
}
