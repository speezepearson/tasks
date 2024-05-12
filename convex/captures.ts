import { v } from "convex/values";
import { mutationWithUser, queryWithUser } from "./lib/withUser";
import { getOneFiltered } from "./lib/helpers";

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
    if (await getOneFiltered(ctx.db, id, 'owner', ctx.user._id) === null) {
      throw new Error('not found');
    }

    await ctx.db.patch(id, { archivedAtMillis: Date.now() });
  },
});
