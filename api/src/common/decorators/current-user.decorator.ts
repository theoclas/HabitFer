import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type AuthUserPayload = { userId: string; email: string; username: string; role?: string };

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUserPayload => {
  const req = ctx.switchToHttp().getRequest();
  return req.user;
});
