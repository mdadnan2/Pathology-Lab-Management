import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { ResponseTransformInterceptor } from './response-transform.interceptor';

describe('ResponseTransformInterceptor', () => {
  const context = {} as ExecutionContext;

  it('wraps a raw profile in the standard single-level response envelope', (done) => {
    const profile = { id: 'user-1', role: 'OWNER' };
    const interceptor = new ResponseTransformInterceptor();
    const next = { handle: () => of(profile) } as CallHandler;

    interceptor.intercept(context, next).subscribe((response) => {
      expect(response).toEqual({ data: profile });
      done();
    });
  });

  it('preserves the message on explicitly enveloped authentication responses', (done) => {
    const profile = { id: 'user-1', role: 'OWNER' };
    const response = { data: profile, message: 'Login successful' };
    const interceptor = new ResponseTransformInterceptor();
    const next = { handle: () => of(response) } as CallHandler;

    interceptor.intercept(context, next).subscribe((result) => {
      expect(result).toEqual(response);
      done();
    });
  });
});
