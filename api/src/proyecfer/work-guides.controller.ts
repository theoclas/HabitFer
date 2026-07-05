import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUserPayload } from '../common/decorators/current-user.decorator';
import {
  CreateWorkGuideDto,
  CreateWorkGuideStepDto,
  ReorderStepsDto,
  UpdateWorkGuideDto,
  UpdateWorkGuideStepDto,
} from './dto/work-guide.dto';
import { WorkGuidesService } from './work-guides.service';

@Controller('proyecfer')
@UseGuards(JwtAuthGuard)
export class WorkGuidesController {
  constructor(private guides: WorkGuidesService) {}

  @Get('projects/:projectId/work-guides')
  list(@CurrentUser() user: AuthUserPayload, @Param('projectId') projectId: string) {
    return this.guides.listByProject(user.userId, projectId);
  }

  @Post('projects/:projectId/work-guides')
  create(
    @CurrentUser() user: AuthUserPayload,
    @Param('projectId') projectId: string,
    @Body() body: CreateWorkGuideDto,
  ) {
    return this.guides.create(user.userId, projectId, body);
  }

  @Get('work-guides/:guideId')
  getOne(@CurrentUser() user: AuthUserPayload, @Param('guideId') guideId: string) {
    return this.guides.getOne(user.userId, guideId);
  }

  @Patch('work-guides/:guideId')
  update(
    @CurrentUser() user: AuthUserPayload,
    @Param('guideId') guideId: string,
    @Body() body: UpdateWorkGuideDto,
  ) {
    return this.guides.update(user.userId, guideId, body);
  }

  @Delete('work-guides/:guideId')
  remove(@CurrentUser() user: AuthUserPayload, @Param('guideId') guideId: string) {
    return this.guides.remove(user.userId, guideId);
  }

  @Post('work-guides/:guideId/steps')
  addStep(
    @CurrentUser() user: AuthUserPayload,
    @Param('guideId') guideId: string,
    @Body() body: CreateWorkGuideStepDto,
  ) {
    return this.guides.addStep(user.userId, guideId, body);
  }

  @Patch('work-guides/steps/:stepId')
  updateStep(
    @CurrentUser() user: AuthUserPayload,
    @Param('stepId') stepId: string,
    @Body() body: UpdateWorkGuideStepDto,
  ) {
    return this.guides.updateStep(user.userId, stepId, body);
  }

  @Delete('work-guides/steps/:stepId')
  removeStep(@CurrentUser() user: AuthUserPayload, @Param('stepId') stepId: string) {
    return this.guides.removeStep(user.userId, stepId);
  }

  @Put('work-guides/:guideId/steps/reorder')
  reorder(
    @CurrentUser() user: AuthUserPayload,
    @Param('guideId') guideId: string,
    @Body() body: ReorderStepsDto,
  ) {
    return this.guides.reorderSteps(user.userId, guideId, body.stepIds);
  }
}
