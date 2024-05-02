import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { vPendingMiscBlockerSpec, vPendingTaskSpec } from "./schema";
import { unbundleBlockers } from "./tasks";

export const create = mutation({
  args: {
    text: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("captures", { text: args.text });
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("captures").withIndex('archivedAtMillis', q => q.eq('archivedAtMillis', undefined)).order('desc').collect();
  },
});

export const dissolve = mutation({
  args: {
    id: v.id("captures"),
    project: v.optional(v.id("projects")),
    tasks: v.array(vPendingTaskSpec),
    miscBlockers: v.array(vPendingMiscBlockerSpec),
  },
  handler: async (ctx, args) => {
    const capture = await ctx.db.get(args.id);
    if (capture === null) {
      throw new Error('Capture not found');
    }

    await ctx.db.patch(args.id, { archivedAtMillis: Date.now() });
    await unbundleBlockers(ctx, {
      project: args.project,
      newTasks: args.tasks,
      newMiscBlockers: args.miscBlockers,
    });
  },
});
