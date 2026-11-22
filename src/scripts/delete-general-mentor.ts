import 'dotenv/config'
import { getPayload } from 'payload'
import config from '@/payload.config'

async function deleteGeneralMentor() {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'mentors',
    where: { slug: { equals: 'general' } },
    limit: 10,
    depth: 0,
    overrideAccess: true,
  })

  if (result.docs.length === 0) {
    console.log('No General mentor profile found.')
    return
  }

  for (const mentor of result.docs as any[]) {
    const assignedUsers = await payload.find({
      collection: 'users',
      where: { mentor: { equals: mentor.id } },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    })

    for (const user of assignedUsers.docs as any[]) {
      await payload.update({
        collection: 'users',
        id: user.id,
        data: { mentor: null },
        overrideAccess: true,
      })
    }

    await payload.delete({
      collection: 'mentors',
      id: mentor.id,
      overrideAccess: true,
    })

    console.log(`Deleted General mentor profile ${mentor.id} and cleared ${assignedUsers.docs.length} user assignment(s).`)
  }
}

deleteGeneralMentor()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('delete-general-mentor failed:', error)
    process.exit(1)
  })
