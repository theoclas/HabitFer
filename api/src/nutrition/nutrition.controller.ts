import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUserPayload } from '../common/decorators/current-user.decorator';
import { DiaryService } from './diary.service';
import { FoodsService } from './foods.service';
import { CreateEntryDto, CreateFoodDto, DayQueryDto, ProfileDto, SearchQueryDto, UpdateEntryDto } from './nutrition.dto';
import { ProfileService } from './profile.service';

/** NutriFer: alimentos, diario de comidas y meta. */
@Controller('nutrition')
@UseGuards(JwtAuthGuard)
export class NutritionController {
  constructor(
    private foods: FoodsService,
    private diary: DiaryService,
    private profiles: ProfileService,
  ) {}

  @Get('foods/search')
  search(@CurrentUser() user: AuthUserPayload, @Query() query: SearchQueryDto) {
    return this.foods.search(user.userId, query.q ?? '');
  }

  @Get('foods/recent')
  recent(@CurrentUser() user: AuthUserPayload, @Query() query: SearchQueryDto) {
    return this.foods.recent(user.userId, query.meal);
  }

  @Get('foods/:id')
  food(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.foods.detail(user.userId, id);
  }

  @Post('foods')
  createFood(@CurrentUser() user: AuthUserPayload, @Body() dto: CreateFoodDto) {
    return this.foods.create(user.userId, dto);
  }

  @Get('day')
  day(@CurrentUser() user: AuthUserPayload, @Query() query: DayQueryDto) {
    return this.diary.day(user.userId, query.date);
  }

  @Post('entries')
  addEntry(@CurrentUser() user: AuthUserPayload, @Body() dto: CreateEntryDto) {
    return this.diary.add(user.userId, dto);
  }

  @Patch('entries/:id')
  updateEntry(@CurrentUser() user: AuthUserPayload, @Param('id') id: string, @Body() dto: UpdateEntryDto) {
    return this.diary.update(user.userId, id, dto);
  }

  @Delete('entries/:id')
  removeEntry(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.diary.remove(user.userId, id);
  }

  @Get('profile')
  profile(@CurrentUser() user: AuthUserPayload) {
    return this.profiles.get(user.userId);
  }

  @Put('profile')
  saveProfile(@CurrentUser() user: AuthUserPayload, @Body() dto: ProfileDto) {
    return this.profiles.save(user.userId, dto);
  }

  /** La meta que saldría con estos datos, sin guardar (para verla mientras se llena el formulario). */
  @Post('profile/preview')
  preview(@Body() dto: ProfileDto) {
    return this.profiles.preview(dto);
  }
}
