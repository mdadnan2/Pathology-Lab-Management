---
applyTo: "apps/api/**/*.ts"
---

# Backend Instructions

## NestJS module structure

Each feature module follows this layout:
```
modules/[feature]/
  [feature].module.ts
  [feature].controller.ts
  [feature].service.ts
  dto/
    create-[feature].dto.ts
    update-[feature].dto.ts
    [feature]-response.dto.ts
  entities/          (optional — Prisma types are usually sufficient)
  [feature].service.spec.ts
  [feature].controller.spec.ts
```

## Controllers

Controllers handle HTTP concerns only:
- Parse and validate request (via ValidationPipe + DTOs)
- Call the appropriate service method
- Return the result (ResponseTransformInterceptor wraps it)
- Apply `@UseGuards`, `@Roles`, `@ApiTags`, `@ApiOperation` decorators

Never put business logic, Prisma queries, or financial calculations in a controller.

## Services

Services own all business logic:
- Validate business rules (not just input shape)
- Orchestrate multi-step operations inside DB transactions
- Throw appropriate NestJS exceptions on failure
- Call PrismaService for persistence
- Emit audit events via AuditService

## DTOs

- Use `class-validator` decorators for all incoming DTOs
- Use `class-transformer` `@Expose()` and `@Exclude()` for response DTOs
- Never expose password hashes, internal IDs of sensitive tables, or audit internals in responses
- Use `@IsEnum`, `@IsUUID`, `@IsDecimal`, `@IsISO8601` for typed fields

## Guards and decorators

```ts
@UseGuards(JwtAuthGuard)                    // require authentication
@UseGuards(JwtAuthGuard, RolesGuard)        // require authentication + role
@Roles(Role.ADMIN, Role.OWNER)              // allowed roles
@CurrentUser()                              // inject authenticated user from JWT
```

Never rely on client-supplied user identity. Always use `@CurrentUser()`.

## Exception handling

Use NestJS built-in exceptions:
- `NotFoundException` — entity not found
- `BadRequestException` — invalid input or business rule violation
- `ForbiddenException` — authenticated but not authorized
- `UnauthorizedException` — not authenticated
- `ConflictException` — duplicate or state conflict

The global exception filter maps these to the standard error envelope.

## Transactions

Use `prisma.$transaction([...])` or the interactive transaction API for:
- Invoice creation + invoice items
- Payment recording + balance update
- Order creation + order items + sample creation
- Any operation that must succeed or fail atomically

## Logging

Use NestJS `Logger` with the class name as context:
```ts
private readonly logger = new Logger(MyService.name);
```
Log: operation start (debug), significant state changes (log), errors (error).
Never log: passwords, JWT tokens, full patient PII, financial amounts in bulk.

## Swagger

- Annotate all controllers with `@ApiTags`
- Annotate all endpoints with `@ApiOperation`, `@ApiResponse`
- Annotate all DTOs with `@ApiProperty`
- Swagger UI available at `/api/docs` in development only
