/** The server answered, but not with what we asked for. `message` is written for people. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

/** The server could not be reached at all (offline, DNS, CORS, server down). */
export class NetworkError extends Error {
  constructor() {
    super('Can’t reach the server. Check your connection and try again.')
    this.name = 'NetworkError'
  }
}

/** The session ended: the refresh token is gone, expired or was revoked. The user has to sign in again. */
export class SessionExpiredError extends Error {
  constructor() {
    super('Your session has ended. Please sign in again.')
    this.name = 'SessionExpiredError'
  }
}

/** Reads the backend's error shape — `{ "error": { "code", "message" } }` — and tolerates anything else. */
export async function toApiError(response: Response): Promise<ApiError> {
  let code = 'error'
  let message = `Something went wrong (${response.status})`
  try {
    const body = (await response.json()) as { error?: { code?: string; message?: string }; detail?: unknown }
    if (body.error?.message) {
      message = body.error.message
      code = body.error.code ?? code
    } else if (typeof body.detail === 'string') {
      message = body.detail
    }
  } catch {
    /* not JSON: keep the generic message */
  }
  return new ApiError(response.status, code, message)
}
