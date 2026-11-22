import dns from 'node:dns/promises'
import net from 'node:net'

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, '')
}

function isPrivateIPv4(address: string): boolean {
  const octets = address.split('.').map((part) => Number(part))
  if (octets.length !== 4 || octets.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return true
  }

  const [a, b] = octets

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  )
}

function isPrivateIPv6(address: string): boolean {
  const normalized = address.toLowerCase()
  const mappedV4Prefix = '::ffff:'

  if (normalized.startsWith(mappedV4Prefix)) {
    const mappedIPv4 = normalized.slice(mappedV4Prefix.length)
    if (net.isIPv4(mappedIPv4)) {
      return isPrivateIPv4(mappedIPv4)
    }
  }

  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  )
}

export function isPrivateIpAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    return isPrivateIPv4(address)
  }

  if (net.isIPv6(address)) {
    return isPrivateIPv6(address)
  }

  return true
}

export function isPrivateHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname)

  return (
    normalized === 'localhost' ||
    normalized === 'host.docker.internal' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal') ||
    normalized.endsWith('.home.arpa')
  )
}

export async function assertSafeExternalUrl(input: string | URL): Promise<void> {
  const parsed = typeof input === 'string' ? new URL(input) : input
  const hostname = normalizeHostname(parsed.hostname)

  if (isPrivateHostname(hostname)) {
    throw new Error('Private or internal network URLs are not allowed.')
  }

  if (net.isIP(hostname)) {
    if (isPrivateIpAddress(hostname)) {
      throw new Error('Private or internal network URLs are not allowed.')
    }
    return
  }

  const records = await dns.lookup(hostname, { all: true, verbatim: true }).catch(() => [])
  if (records.some((record) => isPrivateIpAddress(record.address))) {
    throw new Error('Private or internal network URLs are not allowed.')
  }
}
