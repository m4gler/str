type PostgresConnectionEnv = Partial<Record<
  'DATABASE_URL' | 'POSTGRES_PRISMA_URL' | 'POSTGRES_URL' | 'POSTGRES_URL_NON_POOLING',
  string | undefined
>>
type PostgresConnectionKey = keyof PostgresConnectionEnv

export type PostgresPoolConfig = {
  connectionTimeoutMillis?: number
  database: string
  host: string
  idleTimeoutMillis?: number
  max?: number
  password: string
  port: number
  ssl: {
    rejectUnauthorized: false
  }
  user: string
}

export function getPostgresConnectionUrl(
  env: PostgresConnectionEnv = process.env as PostgresConnectionEnv,
  priority: PostgresConnectionKey[] = ['POSTGRES_URL', 'DATABASE_URL', 'POSTGRES_URL_NON_POOLING'],
): string {
  const rawUrl = priority.map((key) => env[key]).find(Boolean)

  if (!rawUrl) {
    throw new Error('Missing POSTGRES connection environment variables.')
  }

  return rawUrl
}

function decodeUrlPart(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function createPostgresPoolConfig(
  rawUrl = getPostgresConnectionUrl(),
  options: Pick<PostgresPoolConfig, 'connectionTimeoutMillis' | 'idleTimeoutMillis' | 'max'> = {},
): PostgresPoolConfig {
  const parsed = new URL(rawUrl)

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 5432,
    user: decodeUrlPart(parsed.username),
    password: decodeUrlPart(parsed.password),
    database: decodeUrlPart(parsed.pathname.replace(/^\//, '')),
    ssl: { rejectUnauthorized: false },
    ...options,
  }
}
