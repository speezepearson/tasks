import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    text: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("captures", { text: args.text });
  },
});

export const list = query({
  args: {
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.query("captures")
      .withIndex('archivedAtMillis', q => q.eq('archivedAtMillis', undefined))
      .order('desc')
      .take(args.limit);
  },
});

export const archive = mutation({
  args: {
    id: v.id("captures"),
  },
  handler: async (ctx, args) => {
    const capture = await ctx.db.get(args.id);
    if (capture === null) {
      throw new Error('Capture not found');
    }

    await ctx.db.patch(args.id, { archivedAtMillis: Date.now() });
  },
});
