declare module 'pg' {
  export class Client {
    constructor(config?: unknown)
    connect(): Promise<void>
    query<T = unknown>(
      queryText: string,
      values?: unknown[],
    ): Promise<{
      rows: T[]
    }>
    end(): Promise<void>
  }
}
