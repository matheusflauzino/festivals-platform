import { describe, expect, it } from 'vitest';
import { AxiosError } from 'axios';
import { getApiErrorMessage } from './error-message';

describe('getApiErrorMessage', () => {
  it('prefers the backend response message over the generic Axios message', () => {
    const error = new AxiosError(
      'Request failed with status code 409',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      {
        status: 409,
        statusText: 'Conflict',
        headers: {},
        config: {} as never,
        data: { message: 'Festival já está publicado.' },
      },
    );

    expect(getApiErrorMessage(error)).toBe('Festival já está publicado.');
  });

  it('falls back to the Axios error message when there is no backend message', () => {
    const error = new AxiosError('Network Error');

    expect(getApiErrorMessage(error)).toBe('Network Error');
  });

  it('falls back to a generic message for non-Error values', () => {
    expect(getApiErrorMessage('oops')).toBe('Erro inesperado.');
  });

  it('accepts a custom fallback message', () => {
    expect(getApiErrorMessage(null, 'Erro ao criar festival.')).toBe('Erro ao criar festival.');
  });
});
