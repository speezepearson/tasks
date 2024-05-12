import { getOneFrom } from "convex-helpers/server/relationships";
import { mutation } from "./_generated/server";

export const store = mutation({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new Error("Called storeUser without authentication present");
        }

        // Check if we've already stored this identity before.
        const user = await getOneFrom(ctx.db, 'users', 'tokenIdentifier', identity.tokenIdentifier);
        if (user !== null) {
            // If we've seen this identity before but the name has changed, patch the value.
            if (user.email !== identity.email) {
                await ctx.db.patch(user._id, { email: identity.email });
            }
            return user._id;
        }
        if (identity.email === undefined) {
            throw new Error("Identity does not have an email address");
        }
        // If it's a new identity, create a new `User`.
        return await ctx.db.insert("users", {
            email: identity.email,
            tokenIdentifier: identity.tokenIdentifier,
        });
    },
});