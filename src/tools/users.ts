import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get } from "../client.js";
import { jsonResult, handleTool } from "../utils/errors.js";
import type { Obj } from "../utils/schemas.js";
import { usersCache, rolesCache } from "../utils/cache.js";
import {
  simplifyUser, simplifyList,
  verbositySchema,
  asV,
} from "../utils/simplify.js";

export function registerUserTools(
  server: McpServer,
): void {
  server.registerTool(
    "kaiten_get_current_user",
    {
      title: "Get Current User",
      description:
        "Current user (id, name, email). id for "
        + "kaiten_get_user_timelogs and kaiten_search_cards "
        + "ownerId.",
      inputSchema: { verbosity: verbositySchema },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({ verbosity }) => {
      const v = asV(verbosity);
      const user = await usersCache.getOrFetch(
        "current",
        () => get<Obj>("/users/current"),
      );
      return jsonResult(simplifyUser(user, v));
    }),
  );

  server.registerTool(
    "kaiten_list_users",
    {
      title: "List Users",
      description:
        "Org users. IDs for kaiten_search_cards filters and "
        + "kaiten_create_card ownerId.",
      inputSchema: { verbosity: verbositySchema },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({ verbosity }) => {
      const v = asV(verbosity);
      const users = await usersCache.getOrFetch(
        "all", () => get("/users"),
      );
      return jsonResult(
        simplifyList(users, simplifyUser, v),
      );
    }),
  );

  server.registerTool(
    "kaiten_get_user_roles",
    {
      title: "Get User Roles",
      description:
        "Current user roles per space. roleId for "
        + "kaiten_create_timelog.",
      inputSchema: { verbosity: verbositySchema },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({ verbosity }) => {
      const v = asV(verbosity);
      const roles = await rolesCache.getOrFetch(
        "roles", () => get("/user-roles"),
      );
      if (v === "raw") return jsonResult(roles);
      if (!Array.isArray(roles)) {
        return jsonResult(roles);
      }
      return jsonResult(
        (roles as Obj[]).map((r) => ({
          id: r.id,
          name: r.name,
          space_id: r.space_id,
        })),
      );
    }),
  );
}
