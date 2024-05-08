import { makeMigration } from "convex-helpers/server/migrations";
import { internalMutation } from "./_generated/server";

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
