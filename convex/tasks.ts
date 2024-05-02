import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { vBlocker, vPendingBlocker, vPendingMiscBlockerSpec, vPendingTaskSpec } from "./schema";
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

export const setCompleted = mutation({
  args: {
    id: v.id("tasks"),
    isCompleted: v.boolean(),
  },
  handler: async (ctx, { id, isCompleted }) => {
    await ctx.db.patch(id, { completedAtMillis: isCompleted ? Date.now() : undefined });
  },
});

export const unbundleBlockers = internalMutation({
  args: {
    project: v.optional(v.id('projects')),
    newTasks: v.array(vPendingTaskSpec),
    newMiscBlockers: v.array(vPendingMiscBlockerSpec),
  },
  handler: async (ctx, args) => {
    const newBlockerIds = await Promise.all(args.newMiscBlockers.map(async (blocker) =>
      await ctx.db.insert("miscBlockers", { text: blocker.text, timeoutMillis: blocker.timeoutMillis, completedAtMillis: undefined })
    ));

    const newTaskIds = await Promise.all(args.newTasks.map(async (newTask) =>
      await ctx.db.insert("tasks", { text: newTask.text, project: args.project, blockers: [] })
    ));

    await Promise.all(args.newTasks.map((newTask, taskIndex) => {
      return ctx.db.patch(newTaskIds[taskIndex], {
        blockers: newTask.blockers.map((blocker) => {
          switch (blocker.type) {
            case 'task':
            case 'time':
            case 'misc':
              return blocker;
            case 'relTask':
              return { type: 'task' as const, id: newTaskIds[blocker.index] };
            case 'relMisc':
              return { type: 'misc' as const, id: newBlockerIds[blocker.index] };
          }
        }),
      });
    }));

    return {
      newTaskIds,
      newBlockerIds,
    };
  },
});

export const setBlockers = mutation({
  args: {
    id: v.id("tasks"),
    blockers: v.object({
      blockers: v.array(vPendingBlocker),
      newTasks: v.array(vPendingTaskSpec),
      newMiscBlockers: v.array(vPendingMiscBlockerSpec),
    })
  },
  handler: async (ctx, { id, blockers }) => {
    const thisTask = await ctx.db.get(id);
    if (thisTask === null) {
      throw new Error('Task not found');
    }

    const { newTaskIds, newBlockerIds } = await unbundleBlockers(ctx, {
      project: thisTask.project,
      newTasks: blockers.newTasks,
      newMiscBlockers: blockers.newMiscBlockers,
    })

    await ctx.db.patch(id, {
      blockers: blockers.blockers.map(b => {
        switch (b.type) {
          case 'task':
          case 'time':
          case 'misc':
            return b;
          case 'relTask':
            return { type: 'task' as const, id: newTaskIds[b.index] };
          case 'relMisc':
            return { type: 'misc' as const, id: newBlockerIds[b.index] };
        }
      }),
    });
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
    case 'misc':
      if (a.type !== b.type) {
        return false;
      }
      return a.id === b.id;
  }
}