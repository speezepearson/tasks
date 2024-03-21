import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
    args: {text: v.string()},
    handler: async (ctx, args) => {
      return await ctx.db.insert("tasks", {text: args.text, isCompleted: false});
    },
  });

export const get = query({
  args: {id: v.id("tasks")},
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const list = query({
    args: {},
    handler: async (ctx) => {
      return await ctx.db.query("tasks").collect();
    },
  });
  
export const setCompleted = mutation({
    args: {
        id: v.id("tasks"),
        isCompleted: v.boolean(),
    },
    handler: async (ctx, { id, isCompleted }) => {
        await ctx.db.patch(id, { isCompleted });
    },
});
