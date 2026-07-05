import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUserPayload } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  list(@Query('status') status?: UserStatus) {
    return this.users.list(status);
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.users.update(id, dto, user.userId);
  }

  @Patch(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: AuthUserPayload) {
    return this.users.approve(id, user.userId);
  }

  @Patch(':id/reject')
  reject(@Param('id') id: string) {
    return this.users.reject(id);
  }

  @Patch(':id/suspend')
  suspend(@Param('id') id: string, @CurrentUser() user: AuthUserPayload) {
    return this.users.suspend(id, user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUserPayload) {
    return this.users.remove(id, user.userId);
  }
}
