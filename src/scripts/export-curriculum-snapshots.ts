import 'dotenv/config'
import { loadCurriculumSource } from '@/lib/curriculum/source'

const filePath = process.argv[2]

try {
  const { snapshot } = loadCurriculumSource({
    filePath,
    rootDir: process.cwd(),
    preferSnapshot: false,
    refreshSnapshot: true,
    writeMarkdown: true,
  })

  console.log(`Curriculum snapshot exported for ${snapshot.releaseKey}`)
  console.log(`Source: ${snapshot.sourceFilePath}`)
  console.log(`Base definitions: ${snapshot.baseDefinitions.length}`)
  console.log(`Override definitions: ${snapshot.overrideDefinitions.length}`)
  process.exit(0)
} catch (error: any) {
  console.error('curriculum:export failed:', error?.message || error)
  process.exit(1)
}
