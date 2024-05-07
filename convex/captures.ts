import { v } from "convex/values";
import { mutationWithUser, queryWithUser } from "./lib/withUser";

export const create = mutationWithUser({
  args: {
    text: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("captures", { owner: ctx.user._id, text: args.text });
  },
});

export const list = queryWithUser({
  args: {
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.query("captures")
      .withIndex('owner_archivedAtMillis', q => q.eq('owner', ctx.user._id).eq('archivedAtMillis', undefined))
      .order('desc')
      .take(args.limit);
  },
});

export const archive = mutationWithUser({
  args: {
    id: v.id("captures"),
  },
  handler: async (ctx, { id }) => {
    if (!((await ctx.db.get(id))?.owner === ctx.user._id)) {
      throw new Error('not found');
    }

    await ctx.db.patch(id, { archivedAtMillis: Date.now() });
  },
});
