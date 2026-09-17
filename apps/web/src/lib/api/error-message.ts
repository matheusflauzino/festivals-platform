import axios from 'axios';

/**
 * Extracts a human-readable message from an error thrown by an API call.
 *
 * For Axios errors, prefers the backend's own error message
 * (`response.data.message`) over Axios's generic "Request failed with
 * status code NNN" — the backend message is what actually explains what
 * went wrong (e.g. a 409 conflict reason). Falls back to the Axios error's
 * own message, then to a generic message for anything else.
 */
export function getApiErrorMessage(error: unknown, fallback = 'Erro inesperado.'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: unknown } | undefined;
    if (typeof data?.message === 'string' && data.message.length > 0) {
      return data.message;
    }
    return error.message || fallback;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
