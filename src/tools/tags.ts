import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get, post, del } from "../client.js";
import {
  jsonResult, textResult, handleTool,
} from "../utils/errors.js";
import { TtlCache } from "../utils/cache.js";

const tagsCache = new TtlCache<unknown>();

interface Tag {
  readonly id: number;
  readonly name: string;
}

export function simplifyTag(
  tag: Record<string, unknown>,
): Tag {
  return {
    id: tag.id as number,
    name: tag.name as string,
  };
}

export function registerTagTools(
  server: McpServer,
): void {
  server.registerTool(
    "kaiten_list_tags",
    {
      title: "List Tags",
      description:
        "All tags with IDs. tagId for kaiten_add_tag/"
        + "kaiten_remove_tag; tagIds on kaiten_search_cards.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async () => {
      const tags = await tagsCache.getOrFetch(
        "all",
        () => get<Record<string, unknown>[]>("/tags"),
      );
      return jsonResult(
        (tags as Record<string, unknown>[])
          .map(simplifyTag),
      );
    }),
  );

  server.registerTool(
    "kaiten_add_tag",
    {
      title: "Add Card Tag",
      description:
        "Tag on card. tagId from kaiten_list_tags; cardId "
        + "from kaiten_search_cards or kaiten_get_card.",
      inputSchema: {
        cardId: z.number().int().describe("Card ID"),
        tagId: z.number().int().describe("Tag ID"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({ cardId, tagId }) => {
      const tags = await tagsCache.getOrFetch(
        "all",
        () => get<Record<string, unknown>[]>("/tags"),
      ) as Record<string, unknown>[];
      const tag = tags.find(
        (t) => t.id === tagId,
      );
      if (!tag) {
        throw new Error(
          `Tag ${tagId} not found. `
          + `Use kaiten_list_tags to get valid IDs.`,
        );
      }
      await post(
        `/cards/${cardId}/tags`,
        { name: tag.name as string },
      );
      return textResult(
        `Tag "${tag.name}" (${tagId}) added to card ${cardId}`,
      );
    }),
  );

  server.registerTool(
    "kaiten_remove_tag",
    {
      title: "Remove Card Tag",
      description:
        "Untag card. tagId from kaiten_list_tags or "
        + "kaiten_get_card (max verbosity).",
      inputSchema: {
        cardId: z.number().int().describe("Card ID"),
        tagId: z.number().int().describe("Tag ID"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({ cardId, tagId }) => {
      await del(
        `/cards/${cardId}/tags/${tagId}`,
      );
      return textResult(
        `Tag ${tagId} removed from card ${cardId}`,
      );
    }),
  );
}
