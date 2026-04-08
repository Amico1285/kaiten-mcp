import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get } from "../client.js";
import {
  jsonResult, handleTool,
} from "../utils/errors.js";
import { type Obj, positiveId } from "../utils/schemas.js";
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
    result.condition = p.condition;
    result.show_on_facade = p.show_on_facade ?? false;
    result.multiline = p.multiline ?? false;
    result.multi_select = p.multi_select ?? false;
    result.values_type = p.values_type ?? null;
    result.fields_settings = p.fields_settings ?? null;
  }
  return result;
}

// Shape from docs/api/custom-property-select-values/
// get-list-of-select-values.md. Not live-verified
// (test workspace has no custom properties at all), but
// the endpoint is documented stable.
function simplifySelectValue(sv: Obj, v: Verbosity): Obj {
  if (v === "raw") return sv;
  const min: Obj = {
    id: sv.id,
    value: sv.value,
    color: sv.color ?? null,
  };
  if (v === "min") return min;
  return {
    ...min,
    custom_property_id: sv.custom_property_id,
    condition: sv.condition,
    sort_order: sv.sort_order,
    external_id: sv.external_id ?? null,
    updated: sv.updated,
  };
}

export function registerCustomFieldTools(
  server: McpServer,
): void {
  server.registerTool(
    "kaiten_list_custom_properties",
    {
      title: "List Custom Properties",
      description:
        "List company-wide custom property definitions "
        + "(custom fields). In Kaiten, custom properties "
        + "are global per company/workspace, not per space. "
        + "The `type` field on each property determines the "
        + "value shape when writing via "
        + "kaiten_update_card.properties: "
        + "string | number | date | select id | "
        + "multi_select ids[] | user id | catalog uid | "
        + "tree uid | etc. Endpoint: "
        + "GET /company/custom-properties.",
      inputSchema: {
        verbosity: verbositySchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({ verbosity }) => {
      const v = asV(verbosity);
      const props = await propsCache.getOrFetch(
        "company:all",
        () => get<Obj[]>("/company/custom-properties"),
      );
      return jsonResult(
        (props as Obj[]).map(
          (p) => simplifyProperty(p, v),
        ),
      );
    }),
  );

  server.registerTool(
    "kaiten_list_custom_property_select_values",
    {
      title: "List Custom Property Select Values",
      description:
        "Get the valid select / multi_select values for "
        + "a custom property. Use this BEFORE writing the "
        + "`properties` map via kaiten_update_card for any "
        + "select / multi_select field — passing arbitrary "
        + "integers will either fail or silently misassign. "
        + "propertyId comes from kaiten_list_custom_"
        + "properties (filter results by type='select' or "
        + "type='multi_select'). Returns id, value (the "
        + "display label), color, sort_order, condition. "
        + "IMPORTANT: if the property exists but is not a "
        + "select-type, the endpoint returns an empty array "
        + "(not 400), so check the property type first. "
        + "404 means the propertyId is not in your company.",
      inputSchema: {
        propertyId: positiveId(
          "Custom property ID (from "
          + "kaiten_list_custom_properties; only "
          + "select/multi_select types have values)",
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
    handleTool(async ({ propertyId, verbosity }) => {
      const v = asV(verbosity);
      const values = await get<Obj[]>(
        `/company/custom-properties/${propertyId}`
        + `/select-values`,
      );
      return jsonResult(
        values.map((sv) => simplifySelectValue(sv, v)),
      );
    }),
  );
}
