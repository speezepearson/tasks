import { makeMigration } from "convex-helpers/server/migrations";
import { internalMutation } from "./_generated/server";

const migration = makeMigration(internalMutation, {
    migrationTable: "migrations",
});

export const defaultTags = migration({
    table: "tasks",
    migrateOne: async (ctx, doc) => {
        if (doc.tags === undefined) {
            await ctx.db.patch(doc._id, { tags: [] });
        }
    },
});

export const removeMiscProject = migration({
    table: "users",
    migrateOne: async (ctx, doc) => {
        if (doc.miscProject !== undefined) {
            await ctx.db.patch(doc._id, { miscProject: undefined });
        }
    },
});
