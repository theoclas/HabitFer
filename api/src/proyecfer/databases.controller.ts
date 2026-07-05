import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUserPayload } from '../common/decorators/current-user.decorator';
import { DatabasesService } from './databases.service';
import { AddDatabaseRowDto, CreateDatabaseDto, UpdateDatabaseRowDto } from './dto/work-guide.dto';

@Controller('proyecfer/databases')
@UseGuards(JwtAuthGuard)
export class DatabasesController {
  constructor(private databases: DatabasesService) {}

  @Post()
  create(@CurrentUser() user: AuthUserPayload, @Body() body: CreateDatabaseDto) {
    return this.databases.create(user.userId, body.pageId, body.title);
  }

  @Get(':databaseId')
  getOne(@CurrentUser() user: AuthUserPayload, @Param('databaseId') databaseId: string) {
    return this.databases.getOne(user.userId, databaseId);
  }

  @Post(':databaseId/rows')
  addRow(
    @CurrentUser() user: AuthUserPayload,
    @Param('databaseId') databaseId: string,
    @Body() body: AddDatabaseRowDto,
  ) {
    return this.databases.addRow(user.userId, databaseId, body.title, body.values);
  }

  @Patch('rows/:rowId')
  updateRow(
    @CurrentUser() user: AuthUserPayload,
    @Param('rowId') rowId: string,
    @Body() body: UpdateDatabaseRowDto,
  ) {
    return this.databases.updateRow(user.userId, rowId, body.values, body.title);
  }
}
