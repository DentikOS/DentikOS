// Stub mínimo para satisfacer referencias a @types/node
// Deno no usa estos tipos realmente, pero el checker los busca

declare module 'node:crypto' {
  export const randomUUID: () => string
  export const createHash: (algorithm: string) => {
    update: (data: string | Uint8Array) => any
    digest: (encoding: string) => string
  }
}

declare module 'node:buffer' {
  export const Buffer: {
    from: (data: string | Uint8Array, encoding?: string) => Uint8Array
    isBuffer: (obj: any) => boolean
  }
}

declare module 'node:fs' {
  export const readFileSync: (path: string, encoding?: string) => string | Uint8Array
  export const writeFileSync: (path: string, data: string | Uint8Array) => void
  export const existsSync: (path: string) => boolean
}

declare module 'node:path' {
  export const join: (...paths: string[]) => string
  export const dirname: (path: string) => string
  export const basename: (path: string) => string
  export const extname: (path: string) => string
}

declare module 'node:process' {
  export const env: Record<string, string | undefined>
  export const cwd: () => string
  export const exit: (code?: number) => never
}
