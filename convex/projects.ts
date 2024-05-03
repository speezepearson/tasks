import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    name: v.string(),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("projects", { name: args.name, color: args.color });
  },
});

export const update = mutation({
  args: {
    id: v.id("projects"),
    name: v.string(),
    color: v.optional(v.string()),
  },
  handler: async (ctx, { id, name, color }) => {
    await ctx.db.patch(id, { name, color });
  },
});

export const get = query({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("projects").collect();
  },
});
