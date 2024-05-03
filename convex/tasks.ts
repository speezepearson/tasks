import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { vBlocker } from "./schema";
import { Doc } from "./_generated/dataModel";

export const create = mutation({
  args: {
    text: v.string(),
    blockers: v.optional(v.array(vBlocker)),
    project: v.optional(v.id('projects')),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("tasks", { text: args.text, project: args.project, blockers: args.blockers ?? [] });
  },
});

export const get = query({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("tasks").collect();
  },
});

export const update = mutation({
  args: {
    id: v.id("tasks"),
    text: v.string(),
    project: v.optional(v.id('projects')),
  },
  handler: async (ctx, { id, text, project }) => {
    await ctx.db.patch(id, { text, project });
  },
});

export const setCompleted = mutation({
  args: {
    id: v.id("tasks"),
    isCompleted: v.boolean(),
  },
  handler: async (ctx, { id, isCompleted }) => {
    await ctx.db.patch(id, { completedAtMillis: isCompleted ? Date.now() : undefined });
  },
});

export const unlinkBlocker = mutation({
  args: {
    id: v.id("tasks"),
    blocker: vBlocker,
  },
  handler: async (ctx, { id, blocker }) => {
    const task = await ctx.db.get(id);
    if (task === null) {
      throw new Error('Task not found');
    }
    await ctx.db.patch(id, { blockers: task.blockers.filter((b) => !blockersEqual(b, blocker)) });
  },
});

export const linkBlocker = mutation({
  args: {
    id: v.id("tasks"),
    blocker: vBlocker,
  },
  handler: async (ctx, { id, blocker }) => {
    const task = await ctx.db.get(id);
    if (task === null) {
      throw new Error('Task not found');
    }
    if (task.blockers.some((b) => blockersEqual(b, blocker))) {
      throw new Error('Blocker already linked');
    }
    await ctx.db.patch(id, { blockers: [...task.blockers, blocker] });
  },
});

const blockersEqual = (a: Doc<'tasks'>['blockers'][0], b: Doc<'tasks'>['blockers'][0]) => {
  switch (a.type) {
    case 'task':
      if (a.type !== b.type) {
        return false;
      }
      return a.id === b.id;
    case 'time':
      if (a.type !== b.type) {
        return false;
      }
      return a.millis === b.millis;
    case 'delegation':
      if (a.type !== b.type) {
        return false;
      }
      return a.id === b.id;
  }
}