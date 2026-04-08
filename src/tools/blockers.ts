import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get, post, patch, del } from "../client.js";
import {
  jsonResult, textResult, handleTool,
} from "../utils/errors.js";
import {
  type Obj, positiveId, optionalPositiveId, boolish,
  buildOptionalBody, requireSomeFields,
  optionalIsoDateTime,
} from "../utils/schemas.js";
import {
  asV,
  verbositySchema,
  type Verbosity,
} from "../utils/simplify.js";
import {
  assertChildBelongsToParent,
} from "../utils/preflight.js";

// Inline simplify helper (same pattern as files.ts/simplifyFile —
// keeps src/utils/simplify.ts untouched so Phase 3 siblings don't
// conflict on that file). Shape mirrors the fields documented in
// docs/api/card-blockers/retrieve-card-blockers-list.md. The list
// endpoint returns rich nested `blocker` (user), `blocked_card`,
// and `card` (blocking card) objects which are passed through at
// verbosity=max so an LLM doesn't need a second round-trip to
// resolve who blocked what.
export function simplifyBlocker(b: Obj, v: Verbosity): Obj {
  if (v === "raw") return b;
  const base: Obj = {
    id: b.id,
    reason: b.reason ?? null,
    blocker_card_id: b.blocker_card_id ?? null,
    blocker_card_title: b.blocker_card_title ?? null,
    released: b.released ?? false,
  };
  if (v === "min") return base;
  base.card_id = b.card_id;
  base.blocker_id = b.blocker_id ?? null;
  base.due_date = b.due_date ?? null;
  base.created = b.created;
  base.updated = b.updated;
  if (v === "normal") return base;
  // verbosity=max: add the extra flags and the nested user/card
  // objects the list endpoint embeds for each blocker row.
  base.released_by_id = b.released_by_id ?? null;
  base.due_date_time_present = b.due_date_time_present ?? false;
  base.blocker = b.blocker ?? null;
  base.blocked_card = b.blocked_card ?? null;
  base.card = b.card ?? null;
  return base;
}

export function registerBlockerTools(
  server: McpServer,
): void {
  server.registerTool(
    "kaiten_list_card_blockers",
    {
      title: "List Card Blockers",
      description:
        "List all blockers on a card. Each blocker has either a "
        + "free-text `reason`, a pointer to a blocking card "
        + "(`blocker_card_id` + `blocker_card_title`), or both. "
        + "`released:true` means the block is soft-released but "
        + "still in history; release via kaiten_update_card_blocker "
        + "or hard-delete via kaiten_delete_card_blocker. "
        + "cardId from kaiten_search_cards. "
        + "Returns: array of blocker objects (simplified per "
        + "verbosity).",
      inputSchema: {
        cardId: positiveId(
          "Card ID (from kaiten_search_cards)",
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
      const blockers = await get<Obj[]>(
        `/cards/${cardId}/blockers`,
      );
      return jsonResult(
        blockers.map((b) => simplifyBlocker(b, v)),
      );
    }),
  );

  server.registerTool(
    "kaiten_add_card_blocker",
    {
      title: "Add Card Blocker",
      description:
        "Block a card. At least one of `reason` (free-text) or "
        + "`blockerCardId` (pointer to blocking card) must be "
        + "provided. A card blocker can have BOTH: e.g., "
        + "blockerCardId=42 plus reason='waiting for the design "
        + "review on that card'. "
        + "Returns: the created blocker object.",
      inputSchema: {
        cardId: positiveId(
          "Card ID (from kaiten_search_cards)",
        ),
        reason: z.string().min(1).max(4096).optional().describe(
          "Block reason (free text, 1-4096 chars)",
        ),
        blockerCardId: optionalPositiveId(
          "Blocking card ID (from kaiten_search_cards)",
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
    handleTool(async ({
      cardId, reason, blockerCardId, verbosity,
    }) => {
      const v = asV(verbosity);
      const body = buildOptionalBody([
        ["reason", reason],
        ["blocker_card_id", blockerCardId],
      ]);
      requireSomeFields(body, "kaiten_add_card_blocker", [
        "reason", "blockerCardId",
      ]);
      const blocker = await post<Obj>(
        `/cards/${cardId}/blockers`, body,
      );
      return jsonResult(simplifyBlocker(blocker, v));
    }),
  );

  server.registerTool(
    "kaiten_update_card_blocker",
    {
      title: "Update Card Blocker",
      description:
        "Patch an existing blocker. Typical uses: soft-release "
        + "via `released:true` (keeps history) or edit `reason`. "
        + "blockerId from kaiten_list_card_blockers. Preflight "
        + "verifies the blocker actually belongs to this card.",
      inputSchema: {
        cardId: positiveId(
          "Card ID (from kaiten_search_cards)",
        ),
        blockerId: positiveId(
          "Blocker ID (from kaiten_list_card_blockers)",
        ),
        reason: z.string().min(1).max(4096).optional().describe(
          "Block reason (free text, 1-4096 chars)",
        ),
        blockerCardId: optionalPositiveId(
          "Repoint to a different blocking card ID",
        ),
        released: boolish.optional().describe(
          "Mark the blocker as released (soft; keeps history)",
        ),
        dueDate: optionalIsoDateTime(
          "Block deadline in ISO 8601 "
          + "(YYYY-MM-DD or full datetime)",
        ),
        dueDateTimePresent: boolish.optional().describe(
          "Whether the due_date carries a time component",
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
      cardId, blockerId, verbosity, ...fields
    }) => {
      const v = asV(verbosity);
      const body = buildOptionalBody([
        ["reason", fields.reason],
        ["blocker_card_id", fields.blockerCardId],
        ["released", fields.released],
        ["due_date", fields.dueDate],
        ["due_date_time_present", fields.dueDateTimePresent],
      ]);
      requireSomeFields(body, "kaiten_update_card_blocker", [
        "reason", "blockerCardId", "released",
        "dueDate", "dueDateTimePresent",
      ]);
      await assertChildBelongsToParent({
        toolName: "kaiten_update_card_blocker",
        childId: blockerId,
        childDescriptor: `blocker ${blockerId}`,
        parentDescriptor: `card ${cardId}`,
        fetchPool: () => get<Obj[]>(
          `/cards/${cardId}/blockers`,
        ),
      });
      const blocker = await patch<Obj>(
        `/cards/${cardId}/blockers/${blockerId}`, body,
      );
      return jsonResult(simplifyBlocker(blocker, v));
    }),
  );

  server.registerTool(
    "kaiten_delete_card_blocker",
    {
      title: "Delete Card Blocker",
      description:
        "Hard-delete a blocker from a card (removes the row "
        + "entirely; for soft release use "
        + "kaiten_update_card_blocker with released:true). "
        + "Preflight verifies the blocker belongs to this card. "
        + "blockerId from kaiten_list_card_blockers.",
      inputSchema: {
        cardId: positiveId(
          "Card ID (from kaiten_search_cards)",
        ),
        blockerId: positiveId(
          "Blocker ID (from kaiten_list_card_blockers)",
        ),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({ cardId, blockerId }) => {
      await assertChildBelongsToParent({
        toolName: "kaiten_delete_card_blocker",
        childId: blockerId,
        childDescriptor: `blocker ${blockerId}`,
        parentDescriptor: `card ${cardId}`,
        fetchPool: () => get<Obj[]>(
          `/cards/${cardId}/blockers`,
        ),
      });
      await del(
        `/cards/${cardId}/blockers/${blockerId}`,
      );
      return textResult(
        `Blocker ${blockerId} deleted from card ${cardId}`,
      );
    }),
  );
}
