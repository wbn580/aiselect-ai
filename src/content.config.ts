import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const articles = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/articles" }),
  schema: z.object({
  ogImage: z.any().optional(),  // og-wiring: frontmatter 逐页图，不声明会被 zod 丢掉
    title: z.string(),
    description: z.string(),
    category: z.string().optional().default('general'),
    pubDatetime: z.string().optional(),
    publishDate: z.string().optional().default(''),
    modDate: z.string().optional(),
    rating: z.number().min(1).max(10).optional(),
    readingTime: z.number().optional(),
    tags: z.array(z.string()).default([]),
    hideFromHome: z.boolean().optional().default(false),
  }),
});

export const collections = { articles };
