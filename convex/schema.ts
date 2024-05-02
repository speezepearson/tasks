import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const vBlocker = v.union(
  v.object({ type: v.literal('task'), id: v.id('tasks') }),
  v.object({ type: v.literal('time'), millis: v.number() }),
  v.object({ type: v.literal('misc'), id: v.id('miscBlockers') }),
);

export default defineSchema({
  projects: defineTable({
    name: v.string(),
    color: v.optional(v.string()),
  }),

  captures: defineTable({
    text: v.string(),
    archivedAtMillis: v.optional(v.number()),
  })
    .index('archivedAtMillis', ['archivedAtMillis'])
  ,

  tasks: defineTable({
    text: v.string(),
    completedAtMillis: v.optional(v.number()),
    blockers: v.array(vBlocker),
    project: v.optional(v.id('projects')),
  }),

  miscBlockers: defineTable({
    text: v.string(),
    timeoutMillis: v.optional(v.number()),
    completedAtMillis: v.optional(v.number()),
  }),
});
