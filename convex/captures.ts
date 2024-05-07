import { v } from "convex/values";
import { mutationWithUser, queryWithUser } from "./lib/withUser";

export const create = mutationWithUser({
  args: {
    text: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("captures", { text: args.text });
  },
});

export const list = queryWithUser({
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

export const archive = mutationWithUser({
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
