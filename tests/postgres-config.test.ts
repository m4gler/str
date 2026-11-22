import { createPostgresPoolConfig, getPostgresConnectionUrl } from '@/lib/postgresConfig'

describe('postgresConfig', () => {
  it('parses Postgres URLs without allowing sslmode query params to override SSL config', () => {
    const config = createPostgresPoolConfig(
      'postgres://user:pass@example.com:6543/app_db?sslmode=require&pgbouncer=true',
      { max: 5 },
    )

    expect(config).toMatchObject({
      host: 'example.com',
      port: 6543,
      user: 'user',
      password: 'pass',
      database: 'app_db',
      ssl: { rejectUnauthorized: false },
      max: 5,
    })
    expect(config).not.toHaveProperty('connectionString')
  })

  it('supports explicit env priority for scripts that need a non-pooling URL first', () => {
    const env = {
      DATABASE_URL: 'postgres://db:first@example.com/db',
      POSTGRES_URL: 'postgres://pool:first@example.com/db',
      POSTGRES_URL_NON_POOLING: 'postgres://nonpool:first@example.com/db',
      POSTGRES_PRISMA_URL: 'postgres://prisma:first@example.com/db',
    }

    expect(getPostgresConnectionUrl(env, ['POSTGRES_PRISMA_URL', 'POSTGRES_URL_NON_POOLING'])).toBe(
      env.POSTGRES_PRISMA_URL,
    )
  })
})
