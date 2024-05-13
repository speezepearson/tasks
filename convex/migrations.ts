import { makeMigration } from "convex-helpers/server/migrations";
import { internalMutation } from "./_generated/server";
import { getManyFrom } from "convex-helpers/server/relationships";
import { Id } from "./_generated/dataModel";

const migration = makeMigration(internalMutation, {
    migrationTable: "migrations",
});

export const createExplicitMiscProjects = migration({
    table: "users",
    migrateOne: async (ctx, doc) => {
        const miscProject = await (async () => {
            const existing = await ctx.db.query("projects").withIndex('owner_name', q => q.eq('owner', doc._id).eq('name', 'Misc')).collect();
            if (existing.length > 0) {
                return existing[0]._id;
            }
            return await ctx.db.insert("projects", { owner: doc._id, name: "Misc" });
        })()
        const miscTasks = await ctx.db.query("tasks")
            .withIndex('owner', q => q.eq('owner', doc._id))
            .filter(q => q.eq(q.field('project'), undefined))
            .collect();
        const miscDelegations = await ctx.db.query("delegations")
            .withIndex('owner', q => q.eq('owner', doc._id))
            .filter(q => q.eq(q.field('project'), undefined))
            .collect();
        console.log(`patching ${miscTasks.length} tasks to point at ${miscProject} for user ${doc._id}`)
        await Promise.all([
            ...miscTasks.map(t => ctx.db.patch(t._id, { project: miscProject })),
            ...miscDelegations.map(d => ctx.db.patch(d._id, { project: miscProject }))
        ]);
        await ctx.db.patch(doc._id, { miscProject });
    },
});

export const createInboxProjects = migration({
    table: "users",
    migrateOne: async (ctx, doc) => {
        const inboxProject = await (async () => {
            const existing = await ctx.db.query("projects").withIndex('owner_name', q => q.eq('owner', doc._id).eq('name', 'Inbox')).collect();
            if (existing.length > 0) {
                return existing[0]._id;
            }
            return await ctx.db.insert("projects", { owner: doc._id, name: "Inbox" });
        })()
        const captures = await ctx.db.query("captures")
            .withIndex('owner_archivedAtMillis', q => q.eq('owner', doc._id))
            .collect();
        console.log(`patching ${captures.length} captures to point at ${inboxProject} for user ${doc._id}`)
        await Promise.all(captures.map(async (c) => {
            await ctx.db.insert("tasks", { owner: doc._id, text: c.text, project: inboxProject, blockers: [] });
            await ctx.db.patch(c._id, { archivedAtMillis: new Date().getTime() });
        }));
    },
});

export const abandonDelegations = migration({
    table: "users",
    migrateOne: async (ctx, doc) => {
        const delegations = await getManyFrom(ctx.db, "delegations", "owner", doc._id);
        console.log(`patching ${delegations.length} delegations for user ${doc._id}`)
        const idMap: Record<Id<'delegations'>, Id<'tasks'>> = {};
        await Promise.all(delegations.map(async (d) => {
            const newTaskId = await ctx.db.insert("tasks", { owner: doc._id, text: d.text, project: d.project, blockers: [{ type: 'time', millis: d.timeoutMillis }] });
            idMap[d._id] = newTaskId;
            await ctx.db.patch(d._id, { completedAtMillis: new Date().getTime() });
        }));

        const tasks = await getManyFrom(ctx.db, "tasks", "owner", doc._id);
        await Promise.all(tasks.map(async (t) => {
            const needsPatch = [];
            const blockers = t.blockers.map((b) => {
                if (b.type === 'delegation') {
                    needsPatch.push(b.id);
                    const newTaskId = idMap[b.id];
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                    if (newTaskId === undefined) {
                        throw new Error(`missing new task id for delegation ${b.id}`);
                    }
                    return { type: 'task' as const, id: newTaskId };
                }
                return b;
            });
            if (needsPatch.length > 0) {
                await ctx.db.patch(t._id, { blockers });
            }
        }));
    },
});
