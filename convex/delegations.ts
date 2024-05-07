import { v } from "convex/values";
import { mutationWithUser, queryWithUser } from "./lib/withUser";

export const create = mutationWithUser({
  args: {
    text: v.string(),
    timeoutMillis: v.number(),
    project: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("delegations", { text: args.text, timeoutMillis: args.timeoutMillis, completedAtMillis: undefined, project: args.project });
  },
});

export const update = mutationWithUser({
  args: {
    id: v.id("delegations"),
    text: v.string(),
    timeoutMillis: v.optional(v.number()),
    project: v.optional(v.id("projects")),
  },
  handler: async (ctx, { id, ...fields }) => {
    await ctx.db.patch(id, fields);
  },
});

export const get = queryWithUser({
  args: { id: v.id("delegations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const list = queryWithUser({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("delegations").collect();
  },
});

export const setCompleted = mutationWithUser({
  args: {
    id: v.id("delegations"),
    isCompleted: v.boolean(),
  },
  handler: async (ctx, { id, isCompleted }) => {
    await ctx.db.patch(id, { completedAtMillis: isCompleted ? Date.now() : undefined });
  },
});
