import { v } from "convex/values";
import { mutationWithUser, queryWithUser } from "./lib/withUser";
import { getManyFrom } from "convex-helpers/server/relationships";
import { getOneFiltered } from "./lib/helpers";

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
    if (await getOneFiltered(ctx.db, id, 'owner', ctx.user._id) === null) {
      throw new Error('not found');
    }
    await ctx.db.patch(id, fields);
  },
});

export const get = queryWithUser({
  args: { id: v.id("delegations") },
  handler: async (ctx, args) => {
    const res = await getOneFiltered(ctx.db, args.id, 'owner', ctx.user._id);
    if (res === null) {
      throw new Error('not found');
    }
    return res;
  },
});

export const list = queryWithUser({
  args: {},
  handler: async (ctx) => {
    return await getManyFrom(ctx.db, "delegations", "owner", ctx.user._id);
  },
});

export const setCompleted = mutationWithUser({
  args: {
    id: v.id("delegations"),
    isCompleted: v.boolean(),
  },
  handler: async (ctx, { id, isCompleted }) => {
    if (await getOneFiltered(ctx.db, id, 'owner', ctx.user._id) === null) {
      throw new Error('not found');
    }
    await ctx.db.patch(id, { completedAtMillis: isCompleted ? Date.now() : undefined });
  },
});
