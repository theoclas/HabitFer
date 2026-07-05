import { Module } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { CollabProjectsController } from './collab-projects.controller';
import { CollabProjectsService } from './collab-projects.service';
import { CollabTasksController } from './collab-tasks.controller';
import { CollabTasksService } from './collab-tasks.service';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { DatabasesController } from './databases.controller';
import { DatabasesService } from './databases.service';
import { CollabNotificationsController } from './notifications.controller';
import { CollabNotificationsService } from './notifications.service';
import { PagesController } from './pages.controller';
import { BlocksService, PagesService } from './pages.service';
import { PermissionsService } from './permissions.service';
import { WorkGuidesController } from './work-guides.controller';
import { WorkGuidesService } from './work-guides.service';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

@Module({
  controllers: [
    WorkspacesController,
    CollabProjectsController,
    CollabTasksController,
    CommentsController,
    PagesController,
    DatabasesController,
    CollabNotificationsController,
    WorkGuidesController,
  ],
  providers: [
    PermissionsService,
    ActivityService,
    WorkspacesService,
    CollabProjectsService,
    CollabTasksService,
    CommentsService,
    PagesService,
    BlocksService,
    DatabasesService,
    CollabNotificationsService,
    WorkGuidesService,
  ],
})
export class ProyecFerModule {}
