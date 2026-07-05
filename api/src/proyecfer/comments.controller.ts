import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CommentTargetType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUserPayload } from '../common/decorators/current-user.decorator';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/comment.dto';

@Controller('proyecfer/comments')
@UseGuards(JwtAuthGuard)
export class CommentsController {
  constructor(private comments: CommentsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUserPayload,
    @Query('targetType') targetType: CommentTargetType,
    @Query('targetId') targetId: string,
  ) {
    return this.comments.list(targetType, targetId, user.userId);
  }

  @Post()
  create(@CurrentUser() user: AuthUserPayload, @Body() body: CreateCommentDto) {
    return this.comments.create(user.userId, body);
  }
}
