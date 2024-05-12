import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { mutationWithUser, queryWithUser } from "./lib/withUser";
import { vBlocker } from "./schema";
import { getManyFrom } from "convex-helpers/server/relationships";
import { getOneFiltered } from "./lib/helpers";

export const create = mutationWithUser({
  args: {
    text: v.string(),
    blockers: v.optional(v.array(vBlocker)),
    project: v.id('projects'),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("tasks", { owner: ctx.user._id, text: args.text, project: args.project, blockers: args.blockers ?? [] });
  },
});

export const get = queryWithUser({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const x = await getOneFiltered(ctx.db, args.id, 'owner', ctx.user._id);
    return x;
  },
});

export const list = queryWithUser({
  args: {},
  handler: async (ctx) => {
    return await getManyFrom(ctx.db, "tasks", "owner", ctx.user._id);
  },
});

export const update = mutationWithUser({
  args: {
    id: v.id("tasks"),
    text: v.string(),
    project: v.optional(v.id('projects')),
  },
  handler: async (ctx, { id, text, project }) => {
    if (await getOneFiltered(ctx.db, id, 'owner', ctx.user._id) === null) {
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
    if (await getOneFiltered(ctx.db, id, 'owner', ctx.user._id) === null) {
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
    const task = await getOneFiltered(ctx.db, id, 'owner', ctx.user._id);
    if (task === null) {
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
    const task = await getOneFiltered(ctx.db, id, 'owner', ctx.user._id);
    if (task === null) {
      throw new Error('not found');
    }
    if (task.blockers.some((b) => blockersEqual(b, blocker))) {
      throw new Error('Blocker already linked');
    }
    switch (blocker.type) {
      case 'task':
        await (async () => {
          const b = await getOneFiltered(ctx.db, blocker.id, 'owner', ctx.user._id);
          if (b === null) {
            throw new Error('Blocker task does not exist');
          }
          if (b.project !== task.project) {
            throw new Error('Blocker task is in a different project');
          }
        })();
        break;
      case 'delegation':
        await (async () => {
          const b = await getOneFiltered(ctx.db, blocker.id, 'owner', ctx.user._id);
          if (b === null) {
            throw new Error('Blocker delegation does not exist');
          }
          if (b.project !== task.project) {
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
