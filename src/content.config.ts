import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const articles = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/articles" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.string().optional().default('general'),
    pubDatetime: z.string().optional(),
    publishDate: z.string().optional().default(''),
    modDate: z.string().optional(),
    rating: z.number().min(1).max(10).optional(),
    readingTime: z.number().optional(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { articles };
