import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  data: T;
  message?: string;
  meta?: Record<string, unknown>;
}

@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((value) => {
        // Preserve explicitly enveloped responses such as auth profiles/messages
        // as well as paginated service results.
        if (
          value &&
          typeof value === 'object' &&
          'data' in value &&
          ('meta' in value || 'message' in value)
        ) {
          return value as ApiResponse<T>;
        }
        return { data: value };
      }),
    );
  }
}
