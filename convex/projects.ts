import { v } from "convex/values";
import { mutationWithUser, queryWithUser } from "./lib/withUser";

export const create = mutationWithUser({
  args: {
    name: v.string(),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingWithName = await ctx.db.query("projects").withIndex('owner_name', q => q.eq('owner', ctx.user._id).eq('name', args.name)).unique();
    if (existingWithName) {
      throw new Error('a project with that name already exists');
    }
    return await ctx.db.insert("projects", { owner: ctx.user._id, name: args.name, color: args.color });
  },
});

export const archive = mutationWithUser({
  args: { id: v.id("projects") },
  handler: async (ctx, { id }) => {
    if (!((await ctx.db.get(id))?.owner === ctx.user._id)) {
      throw new Error('not found');
    }
    await ctx.db.patch(id, { archivedAtMillis: Date.now() });
  },
});

export const update = mutationWithUser({
  args: {
    id: v.id("projects"),
    name: v.string(),
    color: v.optional(v.string()),
  },
  handler: async (ctx, { id, name, color }) => {
    if (!((await ctx.db.get(id))?.owner === ctx.user._id)) {
      throw new Error('not found');
    }
    const existingWithName = await ctx.db.query("projects").withIndex('owner_name', q => q.eq('owner', ctx.user._id).eq('name', name)).unique();
    if (existingWithName && existingWithName._id !== id) {
      throw new Error('a project with that name already exists');
    }
    await ctx.db.patch(id, { name, color });
  },
});

export const get = queryWithUser({
  args: { id: v.id("projects") },
  handler: async (ctx, args) => {
    const res = await ctx.db.get(args.id);
    if (!(res?.owner === ctx.user._id)) {
      throw new Error('not found');
    }
    return res;
  },
});

export const list = queryWithUser({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("projects").withIndex('owner_archivedAtMillis', q => q.eq('owner', ctx.user._id).eq('archivedAtMillis', undefined)).collect();
  },
});
