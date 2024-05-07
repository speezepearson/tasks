import { v } from "convex/values";
import { vBlocker } from "./schema";
import { Doc } from "./_generated/dataModel";
import { mutationWithUser, queryWithUser } from "./lib/withUser";

export const create = mutationWithUser({
  args: {
    text: v.string(),
    blockers: v.optional(v.array(vBlocker)),
    project: v.optional(v.id('projects')),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("tasks", { owner: ctx.user._id, text: args.text, project: args.project, blockers: args.blockers ?? [] });
  },
});

export const get = queryWithUser({
  args: { id: v.id("tasks") },
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
    return await ctx.db.query("tasks").withIndex('owner', q => q.eq('owner', ctx.user._id)).collect();
  },
});

export const update = mutationWithUser({
  args: {
    id: v.id("tasks"),
    text: v.string(),
    project: v.optional(v.id('projects')),
  },
  handler: async (ctx, { id, text, project }) => {
    if (!((await ctx.db.get(id))?.owner === ctx.user._id)) {
      throw new Error('not found');
    }
    await ctx.db.patch(id, { text, project });
  },
});

export const setCompleted = mutationWithUser({
  args: {
    id: v.id("tasks"),
    isCompleted: v.boolean(),
  },
  handler: async (ctx, { id, isCompleted }) => {
    if (!((await ctx.db.get(id))?.owner === ctx.user._id)) {
      throw new Error('not found');
    }
    await ctx.db.patch(id, { completedAtMillis: isCompleted ? Date.now() : undefined });
  },
});

export const unlinkBlocker = mutationWithUser({
  args: {
    id: v.id("tasks"),
    blocker: vBlocker,
  },
  handler: async (ctx, { id, blocker }) => {
    const task = await ctx.db.get(id);
    if (!(task?.owner === ctx.user._id)) {
      throw new Error('not found');
    }
    await ctx.db.patch(id, { blockers: task.blockers.filter((b) => !blockersEqual(b, blocker)) });
  },
});

export const linkBlocker = mutationWithUser({
  args: {
    id: v.id("tasks"),
    blocker: vBlocker,
  },
  handler: async (ctx, { id, blocker }) => {
    const task = await ctx.db.get(id);
    if (!(task?.owner === ctx.user._id)) {
      throw new Error('not found');
    }
    if (task.blockers.some((b) => blockersEqual(b, blocker))) {
      throw new Error('Blocker already linked');
    }
    switch (blocker.type) {
      case 'task':
        await (async () => {
          const b = await ctx.db.get(blocker.id);
          if (b === null) {
            throw new Error('Blocker task does not exist');
          }
          if (task.project !== undefined && b.project !== task.project) {
            throw new Error('Blocker task is in a different project');
          }
        })();
        break;
      case 'delegation':
        await (async () => {
          const b = await ctx.db.get(blocker.id);
          if (b === null) {
            throw new Error('Blocker delegation does not exist');
          }
          if (task.project !== undefined && b.project !== task.project) {
            throw new Error('Blocker task is in a different project');
          }
        })();
        break;
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