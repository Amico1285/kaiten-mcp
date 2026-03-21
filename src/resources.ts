import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { get } from "./client.js";
import { spacesCache, boardsCache } from "./utils/cache.js";
import type { Obj } from "./utils/schemas.js";

export function registerResources(
  server: McpServer,
): void {
  server.registerResource(
    "spaces",
    "kaiten://spaces",
    {
      title: "Kaiten Spaces",
      description:
        "All spaces with IDs and titles. "
        + "Use spaceId in kaiten_list_boards, "
        + "kaiten_get_space_cards, "
        + "kaiten_list_custom_properties.",
      mimeType: "application/json",
    },
    async () => {
      const spaces = await spacesCache.getOrFetch(
        "all",
        () => get<Obj[]>("/spaces"),
      );
      const items = (spaces as Obj[]).map((s) => ({
        id: s.id,
        title: s.title,
      }));
      return {
        contents: [{
          uri: "kaiten://spaces",
          mimeType: "application/json",
          text: JSON.stringify(items),
        }],
      };
    },
  );

  server.registerResource(
    "boards",
    "kaiten://boards",
    {
      title: "Kaiten Boards",
      description:
        "All boards across spaces (id, title, "
        + "spaceId). Use boardId in "
        + "kaiten_list_columns, "
        + "kaiten_create_card, "
        + "kaiten_search_cards.",
      mimeType: "application/json",
    },
    async () => {
      const spaces = await spacesCache.getOrFetch(
        "all",
        () => get<Obj[]>("/spaces"),
      );
      const allBoards: Obj[] = [];
      for (const space of spaces as Obj[]) {
        const boards = await boardsCache.getOrFetch(
          `space:${space.id}:boards`,
          () => get<Obj[]>(
            `/spaces/${space.id}/boards`,
          ),
        );
        for (const b of boards as Obj[]) {
          allBoards.push({
            id: b.id,
            title: b.title,
            spaceId: space.id,
            spaceTitle: space.title,
          });
        }
      }
      return {
        contents: [{
          uri: "kaiten://boards",
          mimeType: "application/json",
          text: JSON.stringify(allBoards),
        }],
      };
    },
  );
}

export function registerPrompts(
  server: McpServer,
): void {
  server.registerPrompt(
    "create-card",
    {
      title: "Create Card",
      description: "Create a new card on a Kaiten board",
      argsSchema: {
        title: z.string().describe("Card title"),
        boardName: z.string().optional().describe(
          "Board name to find the board",
        ),
      },
    },
    async ({ title, boardName }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Create a Kaiten card titled "${title}"`
            + (boardName
              ? ` on board "${boardName}"`
              : "")
            + ". Steps:\n"
            + "1. Use kaiten_list_spaces to find the space\n"
            + "2. Use kaiten_list_boards to find the board"
            + (boardName
              ? ` matching "${boardName}"`
              : "")
            + "\n"
            + "3. Use kaiten_list_columns for the board\n"
            + "4. Use kaiten_create_card with boardId, "
            + "columnId, and the title",
        },
      }],
    }),
  );

  server.registerPrompt(
    "time-report",
    {
      title: "Time Report",
      description: "Generate a time tracking report for a user",
      argsSchema: {
        from: z.string().describe(
          "Start date (ISO 8601, e.g. 2026-03-01)",
        ),
        to: z.string().describe(
          "End date (ISO 8601, e.g. 2026-03-31)",
        ),
      },
    },
    async ({ from, to }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Generate a time tracking report `
            + `from ${from} to ${to}. Steps:\n`
            + "1. Use kaiten_get_current_user to get userId\n"
            + "2. Use kaiten_get_user_timelogs with "
            + `from="${from}" and to="${to}"\n`
            + "3. Group entries by card and summarize "
            + "total hours per card\n"
            + "4. Show grand total at the end",
        },
      }],
    }),
  );

  server.registerPrompt(
    "board-overview",
    {
      title: "Board Overview",
      description: "Get an overview of a Kaiten board",
      argsSchema: {
        boardName: z.string().describe("Board name"),
      },
    },
    async ({ boardName }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Give me an overview of the board `
            + `"${boardName}". Steps:\n`
            + "1. Use kaiten_list_spaces to find spaces\n"
            + "2. Use kaiten_list_boards to find the board "
            + `matching "${boardName}"\n`
            + "3. Use kaiten_list_columns for the board\n"
            + "4. Use kaiten_get_board_cards to list cards\n"
            + "5. Summarize: total cards, cards per column, "
            + "any overdue or urgent cards",
        },
      }],
    }),
  );
}
