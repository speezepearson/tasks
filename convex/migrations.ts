import { makeMigration } from "convex-helpers/server/migrations";
import { internalMutation } from "./_generated/server";

const migration = makeMigration(internalMutation, {
    migrationTable: "migrations",
});

export const defaultTaskDetails = migration({
    table: "tasks",
    migrateOne: async (ctx, doc) => {
        if (doc.details === undefined) {
            await ctx.db.patch(doc._id, { details: '' });
        }
    },
});
