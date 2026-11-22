/**
 * Global test setup — loads .env and initializes Payload for integration tests.
 *
 * Tests use the REAL database (Supabase). Each test suite creates its own
 * users/data with unique emails and cleans up after itself.
 */
import dotenv from 'dotenv'
import path from 'path'

// Load environment
dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env.local'), override: true })

// Suppress noisy logs during tests
process.env.PAYLOAD_DROP_DATABASE = 'false'
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
process.env.DISABLE_EMAIL_DELIVERY = 'true'
process.env.RESEND_API_KEY = ''

// Suppress drizzle-kit schema introspection unhandled rejections
// (background queries that timeout on Supabase connection pool limits)
process.on('unhandledRejection', (reason: any) => {
  const msg = reason?.message || String(reason)
  if (
    msg.includes('timeout exceeded when trying to connect') ||
    msg.includes('Failed query: SELECT c.column_name') ||
    msg.includes('Failed query: SELECT') ||
    msg.includes('Connection terminated unexpectedly') ||
    msg.includes('DbHandler exited')
  ) {
    // Swallow drizzle-kit background schema introspection errors
    return
  }
  // Re-throw anything else
  throw reason
})
