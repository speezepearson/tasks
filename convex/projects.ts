import { v } from "convex/values";
import { mutationWithUser, queryWithUser } from "./lib/withUser";

export const create = mutationWithUser({
  args: {
    name: v.string(),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("projects", { name: args.name, color: args.color });
  },
});

export const archive = mutationWithUser({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { archivedAtMillis: Date.now() });
  },
});

export const update = mutationWithUser({
  args: {
    id: v.id("projects"),
    name: v.string(),
    color: v.optional(v.string()),
  },
  handler: async (ctx, { id, name, color }) => {
    await ctx.db.patch(id, { name, color });
  },
});

export const get = queryWithUser({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const list = queryWithUser({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("projects").withIndex('archivedAtMillis', q => q.eq('archivedAtMillis', undefined)).collect();
  },
});
