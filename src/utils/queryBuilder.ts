import { getDefaultSpaceId } from "../config.js";
import { addOptionalParams } from "./schemas.js";

export interface CardSearchParams {
  query?: string;
  boardId?: number;
  spaceId?: number;
  columnId?: number;
  laneId?: number;
  ownerId?: number;
  typeId?: number;
  state?: number;
  condition: number;
  asap?: boolean;
  archived?: boolean;
  overdue?: boolean;
  withDueDate?: boolean;
  createdBefore?: string;
  createdAfter?: string;
  updatedBefore?: string;
  updatedAfter?: string;
  dueDateBefore?: string;
  dueDateAfter?: string;
  ownerIds?: string;
  memberIds?: string;
  tagIds?: string;
  typeIds?: string;
  doneOnTime?: boolean;
  excludeArchived?: boolean;
  excludeCompleted?: boolean;
  sortBy: string;
  sortDirection: string;
  limit: number;
  offset: number;
}

export function buildSearchQuery(
  p: CardSearchParams,
): Record<string, string> {
  const q: Record<string, string> = {
    limit: String(p.limit),
    skip: String(p.offset),
    condition: String(p.condition),
    order_by: p.sortBy,
    order_direction: p.sortDirection,
    search_fields: "title",
  };

  addOptionalParams(q, [
    ["query", p.query],
    ["board_id", p.boardId],
    ["space_id", p.spaceId ?? getDefaultSpaceId()],
    ["column_id", p.columnId],
    ["lane_id", p.laneId],
    ["owner_id", p.ownerId],
    ["type_id", p.typeId],
    ["state", p.state],
    ["asap", p.asap],
    ["archived", p.archived],
    ["overdue", p.overdue],
    ["with_due_date", p.withDueDate],
    ["created_before", p.createdBefore],
    ["created_after", p.createdAfter],
    ["updated_before", p.updatedBefore],
    ["updated_after", p.updatedAfter],
    ["due_date_before", p.dueDateBefore],
    ["due_date_after", p.dueDateAfter],
    ["owner_ids", p.ownerIds],
    ["member_ids", p.memberIds],
    ["tag_ids", p.tagIds],
    ["type_ids", p.typeIds],
    ["done_on_time", p.doneOnTime],
    ["exclude_archived", p.excludeArchived],
    ["exclude_completed", p.excludeCompleted],
  ]);

  return q;
}
