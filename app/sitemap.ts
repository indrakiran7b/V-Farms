import type { MetadataRoute } from 'next'

const siteUrl = 'https://v-farms-website-development.vercel.app'

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: siteUrl, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 }]
}
