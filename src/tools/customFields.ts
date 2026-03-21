import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get } from "../client.js";
import {
  jsonResult, handleTool,
} from "../utils/errors.js";
import type { Obj } from "../utils/schemas.js";
import {
  asV,
  verbositySchema,
  type Verbosity,
} from "../utils/simplify.js";
import { TtlCache } from "../utils/cache.js";

const propsCache = new TtlCache<unknown>();

function simplifyProperty(
  p: Obj,
  v: Verbosity,
): Obj {
  if (v === "raw") return p;
  const result: Obj = {
    id: p.id,
    name: p.name,
    type: p.type,
  };
  if (v !== "min") {
    result.required = p.required ?? false;
    result.values = p.values ?? null;
    result.card_type_ids = p.card_type_ids ?? null;
  }
  return result;
}

export function registerCustomFieldTools(
  server: McpServer,
): void {
  server.registerTool(
    "kaiten_list_custom_properties",
    {
      title: "List Custom Properties",
      description:
        "Custom field definitions for a space (types, "
        + "allowed values). spaceId from kaiten_list_spaces.",
      inputSchema: {
        spaceId: z.number().int().describe("Space ID"),
        verbosity: verbositySchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({ spaceId, verbosity }) => {
      const v = asV(verbosity);
      const key = `space_${spaceId}`;
      const props = await propsCache.getOrFetch(
        key,
        () => get<Obj[]>(
          `/spaces/${spaceId}/card-properties`,
        ),
      );
      return jsonResult(
        (props as Obj[]).map(
          (p) => simplifyProperty(p, v),
        ),
      );
    }),
  );
}
