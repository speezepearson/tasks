import { makeMigration } from "convex-helpers/server/migrations";
import { internalMutation } from "./_generated/server";

const migration = makeMigration(internalMutation, {
    migrationTable: "migrations",
});

export const promoteTimeBlockers = migration({
    table: "tasks",
    migrateOne: async (ctx, doc) => {
        const blockedUntilMillis = doc.blockers.reduce((acc, b) => {
            if (b.type === 'time') {
                return Math.max(acc, b.millis);
            }
            return acc;
        }, 0);
        if (blockedUntilMillis > 0) {
            await ctx.db.patch(doc._id, { blockedUntilMillis, blockers: doc.blockers.filter((b) => b.type !== 'time') });
        }
    },
});
