import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUserPayload } from '../common/decorators/current-user.decorator';
import { CreatePageDto, SaveBlocksDto, UpdatePageDto } from './dto/page.dto';
import { BlocksService, PagesService } from './pages.service';

@Controller('proyecfer/pages')
@UseGuards(JwtAuthGuard)
export class PagesController {
  constructor(
    private pages: PagesService,
    private blocks: BlocksService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: AuthUserPayload,
    @Query('workspaceId') workspaceId: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.pages.list(user.userId, workspaceId, projectId);
  }

  @Post()
  create(@CurrentUser() user: AuthUserPayload, @Body() body: CreatePageDto) {
    return this.pages.create(user.userId, body.workspaceId, body);
  }

  @Get(':pageId')
  getOne(@CurrentUser() user: AuthUserPayload, @Param('pageId') pageId: string) {
    return this.pages.getOne(user.userId, pageId);
  }

  @Patch(':pageId')
  update(
    @CurrentUser() user: AuthUserPayload,
    @Param('pageId') pageId: string,
    @Body() body: UpdatePageDto,
  ) {
    return this.pages.update(user.userId, pageId, body);
  }

  @Put(':pageId/blocks')
  saveBlocks(
    @CurrentUser() user: AuthUserPayload,
    @Param('pageId') pageId: string,
    @Body() body: SaveBlocksDto,
  ) {
    return this.blocks.upsertBatch(user.userId, pageId, body.blocks);
  }
}
