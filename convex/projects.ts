import { v } from "convex/values";
import { mutationWithUser, queryWithUser } from "./lib/withUser";
import { getOneFiltered } from "./lib/helpers";

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
    const id = await ctx.db.insert("projects", { owner: ctx.user._id, name: args.name, color: args.color });
    const res = await ctx.db.get(id);
    if (res === null) {
      throw new Error(`internal error: failed to find project ${id} we just wrote`);
    }
    return res;
  },
});

export const archive = mutationWithUser({
  args: { id: v.id("projects") },
  handler: async (ctx, { id }) => {
    if (await getOneFiltered(ctx.db, id, 'owner', ctx.user._id) === null) {
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
    if (await getOneFiltered(ctx.db, id, 'owner', ctx.user._id) === null) {
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
    const res = await getOneFiltered(ctx.db, args.id, 'owner', ctx.user._id);
    if (res === null) {
      throw new Error('not found');
    }
    return res;
  },
});

export const getInbox = queryWithUser({
  args: {},
  handler: async (ctx) => {
    const res = await ctx.db.query("projects").withIndex('owner_name', q => q.eq('owner', ctx.user._id).eq('name', 'Inbox')).unique();
    if (res === null) {
      throw new Error('not found');
    }
    return res;
  },
});

export const getMisc = queryWithUser({
  args: {},
  handler: async (ctx) => {
    const res = await ctx.db.query("projects").withIndex('owner_name', q => q.eq('owner', ctx.user._id).eq('name', 'Misc')).unique();
    if (res === null) {
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
