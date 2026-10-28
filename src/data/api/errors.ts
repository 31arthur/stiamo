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
  // Answers that did not come from the app itself: a gateway with no route for the request, or a service that is down.
  if (response.status === 404) message = 'The server has no such address. It may not have been updated for this version yet (404).'
  else if (response.status === 502 || response.status === 503 || response.status === 504) message = 'The server is starting up or unavailable. Try again in a moment.'
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
