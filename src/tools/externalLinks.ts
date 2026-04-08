import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get, post, patch, del } from "../client.js";
import {
  jsonResult, handleTool,
} from "../utils/errors.js";
import {
  type Obj, positiveId,
  buildOptionalBody, requireSomeFields,
} from "../utils/schemas.js";
import {
  asV,
  verbositySchema,
  type Verbosity,
} from "../utils/simplify.js";
import {
  assertChildBelongsToParent,
} from "../utils/preflight.js";

// Inline simplify helper (same pattern as blockers.ts /
// files.ts — keeps src/utils/simplify.ts untouched). Shape
// documented in docs/api/card-external-links/*.md plus a
// live probe on 2026-04-08:
//   - GET  /cards/{id}/external-links       → rich list with
//     card_id + external_link_id per row
//   - POST /cards/{id}/external-links       → response DOES
//     NOT carry card_id / external_link_id (only id, url,
//     description, uid, external_link_uid, created, updated)
// so the `?? null` fallbacks matter: without them, the
// verbosity=max simplify on a fresh POST would be `undefined`
// for those two fields.
function simplifyExternalLink(l: Obj, v: Verbosity): Obj {
  if (v === "raw") return l;
  const min: Obj = {
    id: l.id,
    url: l.url,
    description: l.description ?? null,
  };
  if (v === "min") return min;
  const normal: Obj = {
    ...min,
    created: l.created,
    updated: l.updated,
  };
  if (v === "normal") return normal;
  return {
    ...normal,
    uid: l.uid ?? null,
    external_link_uid: l.external_link_uid ?? null,
    card_id: l.card_id ?? null,
    external_link_id: l.external_link_id ?? null,
  };
}

export function registerExternalLinkTools(
  server: McpServer,
): void {
  server.registerTool(
    "kaiten_list_card_external_links",
    {
      title: "List Card External Links",
      description:
        "List external links attached to a card. External "
        + "links are URLs (Jira issues, GitHub PRs, design "
        + "docs, etc.) that live in their own UI section on "
        + "the card — separate from the card description, "
        + "so attaching one does not pollute the description "
        + "text. Returns id, url, description plus "
        + "timestamps. Empty array if the card has no "
        + "external links. cardId from kaiten_get_card or "
        + "kaiten_search_cards.",
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
      const links = await get<Obj[]>(
        `/cards/${cardId}/external-links`,
      );
      return jsonResult(
        links.map((l) => simplifyExternalLink(l, v)),
      );
    }),
  );

  server.registerTool(
    "kaiten_add_card_external_link",
    {
      title: "Add Card External Link",
      description:
        "Attach an external link (URL) to a card. Useful "
        + "for linking to Jira issues, GitHub PRs, design "
        + "docs, etc., without bloating the card description. "
        + "url must be a valid URL (max 16384 chars). "
        + "description is optional (max 512 chars). cardId "
        + "from kaiten_get_card. Returns: the created link "
        + "(simplified per verbosity). NOTE: the POST "
        + "response does not carry card_id / "
        + "external_link_id — those fields only appear in "
        + "the subsequent kaiten_list_card_external_links "
        + "response.",
      inputSchema: {
        cardId: positiveId(
          "Card ID (from kaiten_search_cards or "
          + "kaiten_get_card)",
        ),
        url: z.string().url("Must be a valid URL")
          .min(1).max(16384)
          .describe("External URL (max 16384 chars)"),
        description: z.string().max(512).optional()
          .describe(
            "Optional human-readable label "
            + "(max 512 chars)",
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
      cardId, url, description, verbosity,
    }) => {
      const v = asV(verbosity);
      const body = {
        url,
        ...buildOptionalBody([
          ["description", description],
        ]),
      };
      const link = await post<Obj>(
        `/cards/${cardId}/external-links`, body,
      );
      return jsonResult(simplifyExternalLink(link, v));
    }),
  );

  server.registerTool(
    "kaiten_update_card_external_link",
    {
      title: "Update Card External Link",
      description:
        "Update url or description of an existing card "
        + "external link. At least one of url / description "
        + "must be provided (empty PATCH rejected before "
        + "the API call). description accepts null to clear "
        + "the label. linkId belongs to a specific card — "
        + "use kaiten_list_card_external_links to discover "
        + "ids. Preflight verifies the link belongs to the "
        + "given card before PATCHing, to prevent silent "
        + "cross-card mutation.",
      inputSchema: {
        cardId: positiveId(
          "Card ID (parent, from kaiten_search_cards)",
        ),
        linkId: positiveId(
          "External link ID (from "
          + "kaiten_list_card_external_links)",
        ),
        url: z.string().url("Must be a valid URL")
          .min(1).max(16384).optional()
          .describe("New URL (max 16384 chars)"),
        description: z.string().max(512).nullable().optional()
          .describe(
            "New description (max 512 chars), or null "
            + "to clear",
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
      cardId, linkId, verbosity, ...fields
    }) => {
      const v = asV(verbosity);
      const body = buildOptionalBody([
        ["url", fields.url],
        ["description", fields.description],
      ]);
      requireSomeFields(
        body, "kaiten_update_card_external_link",
        ["url", "description"],
      );
      await assertChildBelongsToParent({
        toolName: "kaiten_update_card_external_link",
        childId: linkId,
        childDescriptor: `external link ${linkId}`,
        parentDescriptor: `card ${cardId}`,
        fetchPool: () => get<Obj[]>(
          `/cards/${cardId}/external-links`,
        ),
      });
      const link = await patch<Obj>(
        `/cards/${cardId}/external-links/${linkId}`, body,
      );
      return jsonResult(simplifyExternalLink(link, v));
    }),
  );

  server.registerTool(
    "kaiten_remove_card_external_link",
    {
      title: "Remove Card External Link",
      description:
        "Remove an external link from a card permanently. "
        + "Unlike blockers (where DELETE is a soft release), "
        + "this is a true hard-delete — the link disappears "
        + "from kaiten_list_card_external_links afterwards. "
        + "Preflight verifies the cardId+linkId pair matches "
        + "before deletion, to prevent silent cross-card "
        + "removal. linkId from "
        + "kaiten_list_card_external_links.",
      inputSchema: {
        cardId: positiveId(
          "Card ID (parent, from kaiten_search_cards)",
        ),
        linkId: positiveId(
          "External link ID (from "
          + "kaiten_list_card_external_links)",
        ),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({ cardId, linkId }) => {
      await assertChildBelongsToParent({
        toolName: "kaiten_remove_card_external_link",
        childId: linkId,
        childDescriptor: `external link ${linkId}`,
        parentDescriptor: `card ${cardId}`,
        fetchPool: () => get<Obj[]>(
          `/cards/${cardId}/external-links`,
        ),
      });
      await del(
        `/cards/${cardId}/external-links/${linkId}`,
      );
      return jsonResult({ deleted: true, id: linkId });
    }),
  );
}
