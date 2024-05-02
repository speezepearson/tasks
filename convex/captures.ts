import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { vBlocker } from "./schema";

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

export const vDissolveTask = v.object({
  text: v.string(),
  blockers: v.array(v.union(
    vBlocker,
    v.object({ type: v.literal('relTask'), index: v.number() }),
    v.object({ type: v.literal('relMisc'), index: v.number() }),
  )),
});
export const vDissolveMiscBlocker = v.object({
  text: v.string(),
  timeoutMillis: v.optional(v.number()),
});

export const dissolve = mutation({
  args: {
    id: v.id("captures"),
    project: v.optional(v.id("projects")),
    tasks: v.array(vDissolveTask),
    miscBlockers: v.array(vDissolveMiscBlocker),
  },
  handler: async (ctx, args) => {
    const capture = await ctx.db.get(args.id);
    if (capture === null) {
      throw new Error('Capture not found');
    }

    await ctx.db.patch(args.id, { archivedAtMillis: Date.now() });

    const blockerIds = await Promise.all(args.miscBlockers.map(async (blocker) =>
      await ctx.db.insert("miscBlockers", { text: blocker.text, timeoutMillis: blocker.timeoutMillis, completedAtMillis: undefined })
    ));

    const taskIds = await Promise.all(args.tasks.map(async (task) =>
      await ctx.db.insert("tasks", { text: task.text, project: args.project, blockers: [] })
    ));

    await Promise.all(args.tasks.map((task, taskIndex) => {
      const blockers: (typeof vBlocker.type)[] = task.blockers.map((blocker) => {
        switch (blocker.type) {
          case 'task':
          case 'time':
          case 'misc':
            return blocker;
          case 'relTask':
            return { type: 'task', id: taskIds[blocker.index] };
          case 'relMisc':
            return { type: 'misc', id: blockerIds[blocker.index] };
        }
      });
      return ctx.db.patch(taskIds[taskIndex], { blockers });
    }));
  },
});
