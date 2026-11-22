import { getPayload } from 'payload'
import config from '@/payload.config'
import { getDefaultNewsPost } from '@/lib/newsPosts'

async function seedNewsPosts() {
  const payload = await getPayload({ config })
  const post = getDefaultNewsPost()
  const data = {
    status: post.status,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    category: post.category,
    publishedAt: post.publishedAt,
    readTime: post.readTime,
    urgencyText: post.urgencyText,
    heroBadge: post.heroBadge,
    author: post.author,
    content: post.blocks,
  }

  const existing = await (payload as any).find({
    collection: 'news-posts',
    where: {
      slug: {
        equals: post.slug,
      },
    },
    limit: 1,
  })

  if (existing.docs[0]) {
    await (payload as any).update({
      collection: 'news-posts',
      id: existing.docs[0].id,
      data,
    })
    console.log(`Updated news post: ${post.slug}`)
    return
  }

  await (payload as any).create({
    collection: 'news-posts',
    data,
  })
  console.log(`Created news post: ${post.slug}`)
}

seedNewsPosts().catch((error) => {
  console.error(error)
  process.exit(1)
})
