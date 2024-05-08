import { v } from "convex/values";
import { mutationWithUser, queryWithUser } from "./lib/withUser";

export const create = mutationWithUser({
  args: {
    text: v.string(),
    timeoutMillis: v.number(),
    project: v.id("projects"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("delegations", { owner: ctx.user._id, text: args.text, timeoutMillis: args.timeoutMillis, completedAtMillis: undefined, project: args.project });
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
    if (!((await ctx.db.get(id))?.owner === ctx.user._id)) {
      throw new Error('not found');
    }
    await ctx.db.patch(id, fields);
  },
});

export const get = queryWithUser({
  args: { id: v.id("delegations") },
  handler: async (ctx, args) => {
    const res = await ctx.db.get(args.id);
    if (!(res?.owner === ctx.user._id)) {
      throw new Error('not found');
    }
    return await ctx.db.get(args.id);
  },
});

export const list = queryWithUser({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("delegations").withIndex('owner', q => q.eq('owner', ctx.user._id)).collect();
  },
});

export const setCompleted = mutationWithUser({
  args: {
    id: v.id("delegations"),
    isCompleted: v.boolean(),
  },
  handler: async (ctx, { id, isCompleted }) => {
    if (!((await ctx.db.get(id))?.owner === ctx.user._id)) {
      throw new Error('not found');
    }
    await ctx.db.patch(id, { completedAtMillis: isCompleted ? Date.now() : undefined });
  },
});
