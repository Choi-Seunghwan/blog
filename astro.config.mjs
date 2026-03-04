// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import rehypeMermaid from 'rehype-mermaid';

// https://astro.build/config
export default defineConfig({
  site: 'https://chuz.dev',
  base: '/',
  integrations: [sitemap()],
  markdown: {
    rehypePlugins: [rehypeMermaid],
    shikiConfig: {
      theme: 'css-variables',
      langs: [],
      wrap: true,
    },
  },
});
