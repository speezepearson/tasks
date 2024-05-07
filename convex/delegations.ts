import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    text: v.string(),
    timeoutMillis: v.optional(v.number()),
    project: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("delegations", { text: args.text, timeoutMillis: args.timeoutMillis, completedAtMillis: undefined, project: args.project });
  },
});

export const update = mutation({
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

export const get = query({
  args: { id: v.id("delegations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("delegations").collect();
  },
});

export const setCompleted = mutation({
  args: {
    id: v.id("delegations"),
    isCompleted: v.boolean(),
  },
  handler: async (ctx, { id, isCompleted }) => {
    await ctx.db.patch(id, { completedAtMillis: isCompleted ? Date.now() : undefined });
  },
});
