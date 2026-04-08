import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get } from "../client.js";
import {
  jsonResult, handleTool,
} from "../utils/errors.js";
import {
  type Obj, positiveId, boolish,
} from "../utils/schemas.js";
import {
  simplifyCard,
  asV,
  verbositySchema,
  type Verbosity,
} from "../utils/simplify.js";

// Inline simplify helpers (same pattern as blockers.ts).
// Shape documented in docs/api/sprints/*.md. Note that the
// workspace used for live probes (37controlseeing) has no
// sprints, so only GET /sprints is live-verified (empty
// list 200). GET /sprints/{id} summary shape is
// schema-by-docs until the workspace acquires a real sprint.
function simplifySprint(s: Obj, v: Verbosity): Obj {
  if (v === "raw") return s;
  const min: Obj = {
    id: s.id,
    title: s.title,
    active: s.active,
  };
  if (v === "min") return min;
  const normal: Obj = {
    ...min,
    board_id: s.board_id,
    goal: s.goal ?? null,
    start_date: s.start_date,
    finish_date: s.finish_date,
    actual_finish_date: s.actual_finish_date ?? null,
    committed: s.committed,
    velocity: s.velocity,
    archived: !!s.archived,
  };
  if (v === "normal") return normal;
  return {
    ...normal,
    uid: s.uid ?? null,
    children_committed: s.children_committed ?? null,
    children_velocity: s.children_velocity ?? null,
    creator_id: s.creator_id ?? null,
    updater_id: s.updater_id ?? null,
    velocity_details: s.velocity_details ?? null,
    children_velocity_details:
      s.children_velocity_details ?? null,
    created: s.created ?? null,
    updated: s.updated ?? null,
  };
}

// Sprint summary = sprint object PLUS nested cards array,
// card version history, and used custom properties. At
// verbosity=max we reuse simplifyCard(c, "normal") for each
// card — NOT "max" — to keep the response from exploding
// when a sprint has dozens of cards.
function simplifySprintSummary(s: Obj, v: Verbosity): Obj {
  if (v === "raw") return s;
  const base = simplifySprint(s, v);
  const cards = Array.isArray(s.cards)
    ? (s.cards as Obj[])
    : [];
  if (v === "min") {
    return { ...base, cards_count: cards.length };
  }
  if (v === "normal") {
    return {
      ...base,
      cards_count: cards.length,
      cards: cards.map((c) => ({
        id: c.id,
        title: c.title,
        state: c.state,
        archived: !!c.archived,
        column_id: c.column_id,
      })),
    };
  }
  // max
  return {
    ...base,
    cards_count: cards.length,
    cards: cards.map((c) => simplifyCard(c, "normal")),
    cardUpdates: s.cardUpdates ?? null,
    customProperties: s.customProperties ?? null,
  };
}

export function registerSprintTools(
  server: McpServer,
): void {
  server.registerTool(
    "kaiten_list_sprints",
    {
      title: "List Sprints",
      description:
        "List company sprints with an optional active-flag "
        + "filter. A sprint in Kaiten is a scrum-style "
        + "time-box with velocity/committed tracking. Not "
        + "every workspace uses sprints — an empty array "
        + "means sprints are simply not configured here, "
        + "not that your access is broken. Returns id, "
        + "title, active, dates, velocity. Requires access "
        + "to the company entities tree (403 otherwise). "
        + "Use kaiten_get_sprint for the full per-sprint "
        + "summary including cards.",
      inputSchema: {
        active: boolish.optional().describe(
          "Filter by active flag "
          + "(omit for all sprints)",
        ),
        limit: z.coerce.number().int().positive().max(100)
          .optional()
          .describe("Max results (default 100, max 100)"),
        offset: z.coerce.number().int().nonnegative()
          .optional()
          .describe("Offset for pagination"),
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
      active, limit, offset, verbosity,
    }) => {
      const v = asV(verbosity);
      const query: Record<string, string> = {};
      if (active !== undefined) {
        query.active = String(active);
      }
      if (limit !== undefined) {
        query.limit = String(limit);
      }
      if (offset !== undefined) {
        query.offset = String(offset);
      }
      const sprints = await get<Obj[]>(
        "/sprints",
        Object.keys(query).length > 0 ? query : undefined,
      );
      return jsonResult(
        sprints.map((s) => simplifySprint(s, v)),
      );
    }),
  );

  server.registerTool(
    "kaiten_get_sprint",
    {
      title: "Get Sprint Summary",
      description:
        "Get a full sprint summary: sprint metadata PLUS "
        + "the cards in the sprint, their version history "
        + "(cardUpdates), and the custom properties used. "
        + "The response is LARGE at verbosity=max — prefer "
        + "min (returns cards_count only) or normal "
        + "(returns brief {id,title,state} per card) unless "
        + "you specifically need cardUpdates or "
        + "customProperties. excludeDeletedCards filters "
        + "out cards in condition=3 (deleted). Returns 404 "
        + "if the sprintId is not found, 403 if the caller "
        + "has no access to the sprint's space. sprintId "
        + "from kaiten_list_sprints.",
      inputSchema: {
        sprintId: positiveId(
          "Sprint ID (from kaiten_list_sprints)",
        ),
        excludeDeletedCards: boolish.optional().describe(
          "Exclude cards in condition=3 (deleted) from "
          + "the summary",
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
    handleTool(async ({
      sprintId, excludeDeletedCards, verbosity,
    }) => {
      const v = asV(verbosity);
      const query: Record<string, string> = {};
      if (excludeDeletedCards !== undefined) {
        query.exclude_deleted_cards = String(
          excludeDeletedCards,
        );
      }
      const sprint = await get<Obj>(
        `/sprints/${sprintId}`,
        Object.keys(query).length > 0 ? query : undefined,
      );
      return jsonResult(simplifySprintSummary(sprint, v));
    }),
  );
}
