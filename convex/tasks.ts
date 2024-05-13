import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { mutationWithUser, queryWithUser } from "./lib/withUser";
import { vBlocker } from "./schema";
import { getManyFrom } from "convex-helpers/server/relationships";
import { getOneFiltered } from "./lib/helpers";
import { Set } from "immutable";

export const create = mutationWithUser({
  args: {
    text: v.string(),
    blockers: v.optional(v.array(vBlocker)),
    project: v.id('projects'),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("tasks", {
      owner: ctx.user._id,
      text: args.text,
      project: args.project,
      blockers: args.blockers ?? [],
      tags: args.tags ?? [],
    });
  },
});

export const get = queryWithUser({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const x = await getOneFiltered(ctx.db, args.id, 'owner', ctx.user._id);
    return x;
  },
});

export const listTags = queryWithUser({
  args: {},
  handler: async (ctx) => {
    const tasks = await getManyFrom(ctx.db, "tasks", "owner", ctx.user._id);
    const tags = tasks.reduce((acc, task) => {
      return acc.union(Set(task.tags));
    }, Set<string>());
    return tags.toList().sort().toArray();
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
    text: v.optional(v.string()),
    project: v.optional(v.id('projects')),
    blockedUntilMillis: v.optional(v.object({ new: v.optional(v.number()) })),
    addTags: v.optional(v.array(v.string())),
    delTags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { id, text, project, blockedUntilMillis, addTags, delTags }) => {
    const task = await getOneFiltered(ctx.db, id, 'owner', ctx.user._id);
    if (task === null) {
      throw new Error('not found');
    }
    const tags = (() => {
      if (addTags === undefined && delTags === undefined) {
        return undefined;
      }
      const add = Set(addTags ?? []);
      const del = Set(delTags ?? []);
      if (add.intersect(del).size > 0) {
        throw new Error('tags to add and delete overlap');
      }
      return Set(task.tags).union(add).subtract(del).toList().sort().toArray();
    })();
    console.log('updating task', id, { text, project, tags, blockedUntilMillis });
    await ctx.db.patch(id, {
      ...(text !== undefined ? { text } : {}),
      ...(project !== undefined ? { project } : {}),
      ...(blockedUntilMillis !== undefined ? { blockedUntilMillis: blockedUntilMillis.new } : {}),
      ...(tags !== undefined ? { tags } : {}),
    });
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
    }
    await ctx.db.patch(id, { blockers: [...task.blockers, blocker] });
  },
});

const blockersEqual = (a: Doc<'tasks'>['blockers'][0], b: Doc<'tasks'>['blockers'][0]) => {
  switch (a.type) {
    case 'task':
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (a.type !== b.type) {
        return false;
      }
      return a.id === b.id;
  }
}
