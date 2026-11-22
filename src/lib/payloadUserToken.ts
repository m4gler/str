import { jwtVerify } from 'jose'

export async function findUserFromPayloadToken(
  payload: any,
  token: string,
  findOptions: Record<string, unknown> = {},
) {
  const { payload: jwtPayload } = await jwtVerify(
    token,
    new TextEncoder().encode(payload.secret),
  )

  if (jwtPayload?.collection !== 'users' || !jwtPayload?.id) {
    return null
  }

  return payload.findByID({
    collection: 'users',
    id: jwtPayload.id as string | number,
    ...findOptions,
  })
}
