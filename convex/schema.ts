import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { migrationsTable } from "convex-helpers/server/migrations";

export const vBlocker = v.object({ type: v.literal('task'), id: v.id('tasks') });

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

  tasks: defineTable({
    owner: v.id('users'),
    text: v.string(),
    completedAtMillis: v.optional(v.number()),
    blockers: v.array(vBlocker),
    project: v.id('projects'),
    tags: v.optional(v.array(v.string())),
    blockedUntilMillis: v.optional(v.number()),
  })
    .index('owner_project', ['owner', 'project'])
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
