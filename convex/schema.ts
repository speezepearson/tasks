import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { migrationsTable } from "convex-helpers/server/migrations";

export const vBlocker = v.union(
  v.object({ type: v.literal('task'), id: v.id('tasks') }),
  v.object({ type: v.literal('time'), millis: v.number() }),
  v.object({ type: v.literal('delegation'), id: v.id('delegations') }),
);

export default defineSchema({
  projects: defineTable({
    owner: v.id('users'),
    name: v.string(),
    color: v.optional(v.string()),
    archivedAtMillis: v.optional(v.number()),
  })
    .index('owner_archivedAtMillis', ['owner', 'archivedAtMillis'])
    .index('owner_name', ['owner', 'name'])
  ,

  captures: defineTable({
    owner: v.id('users'),
    text: v.string(),
    archivedAtMillis: v.optional(v.number()),
  })
    .index('owner_archivedAtMillis', ['owner', 'archivedAtMillis'])
  ,

  tasks: defineTable({
    owner: v.id('users'),
    text: v.string(),
    completedAtMillis: v.optional(v.number()),
    blockers: v.array(vBlocker),
    project: v.id('projects'),
  })
    .index('owner', ['owner'])
  ,

  delegations: defineTable({
    owner: v.id('users'),
    text: v.string(),
    timeoutMillis: v.number(),
    completedAtMillis: v.optional(v.number()),
    project: v.id('projects'),
  })
    .index('owner', ['owner'])
  ,

  users: defineTable({
    email: v.string(),
    tokenIdentifier: v.string(),
    miscProject: v.optional(v.id('projects')),
  })
    .index('tokenIdentifier', ['tokenIdentifier'])
    .index('email', ['email'])
  ,

  migrations: migrationsTable,
});
