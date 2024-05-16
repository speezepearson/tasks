import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { mutationWithUser, queryWithUser } from "./lib/withUser";
import { vBlocker } from "./schema";
import { getManyFrom } from "convex-helpers/server/relationships";
import { getOneFiltered } from "./lib/helpers";
import { Set } from "immutable";
import { MutationCtx } from "./_generated/server";

const vNewBlocker = v.union(
  v.object({ type: v.literal('newTask'), text: v.string() }),
  vBlocker,
)
export type NewBlocker = typeof vNewBlocker.type;

export const create = mutationWithUser({
  args: {
    text: v.string(),
    details: v.optional(v.string()),
    blockedUntilMillis: v.optional(v.number()),
    blockers: v.optional(v.array(vNewBlocker)),
    project: v.id('projects'),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const blockers = await concretizeBlockers(ctx, args.blockers ?? [], args.project);
    return await ctx.db.insert("tasks", {
      owner: ctx.user._id,
      text: args.text,
      details: args.details ?? '',
      project: args.project,
      blockedUntilMillis: args.blockedUntilMillis,
      blockers,
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
    const tasks = await getManyFrom(ctx.db, "tasks", "owner_project", ctx.user._id, 'owner');
    const tags = tasks.reduce((acc, task) => {
      return acc.union(Set(task.tags));
    }, Set<string>());
    return tags.toList().sort().toArray();
  },
});

export const list = queryWithUser({
  args: {},
  handler: async (ctx) => {
    return await getManyFrom(ctx.db, "tasks", "owner_project", ctx.user._id, 'owner');
  },
});

export const listProject = queryWithUser({
  args: { project: v.id('projects') },
  handler: async (ctx, args) => {
    return await ctx.db.query('tasks').withIndex('owner_project', q => q.eq('owner', ctx.user._id).eq('project', args.project)).collect();
  },
});

export const update = mutationWithUser({
  args: {
    id: v.id("tasks"),
    text: v.optional(v.string()),
    details: v.optional(v.string()),
    project: v.optional(v.id('projects')),
    blockedUntilMillis: v.optional(v.object({ new: v.optional(v.number()) })),
    blockers: v.optional(v.array(vNewBlocker)),
    tags: v.optional(v.object({
      add: v.optional(v.array(v.string())),
      del: v.optional(v.array(v.string())),
    }))
  },
  handler: async (ctx, { id, text, details, project, blockedUntilMillis, blockers, tags }) => {
    console.log("updating", { id, details })
    const task = await getOneFiltered(ctx.db, id, 'owner', ctx.user._id);
    if (task === null) {
      throw new Error('not found');
    }
    const newTags = tags && (() => {
      if (tags.add === undefined && tags.del === undefined) {
        return undefined;
      }
      const add = Set(tags.add ?? []);
      const del = Set(tags.del ?? []);
      if (add.intersect(del).size > 0) {
        throw new Error('tags to add and delete overlap');
      }
      return Set(task.tags).union(add).subtract(del).toList().sort().toArray();
    })();
    const fullBlockers = blockers && await concretizeBlockers(ctx, blockers, task.project);
    await ctx.db.patch(id, {
      ...(text !== undefined ? { text } : {}),
      ...(details !== undefined ? { details } : {}),
      ...(project !== undefined ? { project } : {}),
      ...(blockedUntilMillis !== undefined ? { blockedUntilMillis: blockedUntilMillis.new } : {}),
      ...(fullBlockers !== undefined ? { blockers: fullBlockers } : {}),
      ...(newTags !== undefined ? { newTags } : {}),
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

async function concretizeBlockers(
  ctx: MutationCtx & { user: Doc<'users'> },
  blockers: NewBlocker[],
  project: Id<'projects'>,
) {

  return await Promise.all((blockers).map(async (blocker) => {
    if (blocker.type === 'newTask') {
      const newTaskId = await ctx.db.insert("tasks", {
        owner: ctx.user._id,
        text: blocker.text,
        details: '',
        project: project,
        blockers: [],
        tags: [],
      });
      return { type: 'task' as const, id: newTaskId };
    }
    return blocker;
  }));
}

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
