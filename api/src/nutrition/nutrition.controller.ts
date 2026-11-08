import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUserPayload } from '../common/decorators/current-user.decorator';
import { DiaryService } from './diary.service';
import { FoodsService } from './foods.service';
import {
  CopyDto,
  CreateEntryDto,
  CreateFoodDto,
  DayQueryDto,
  ProfileDto,
  QuickEntryDto,
  RecipeDto,
  RemoveEntriesDto,
  RepeatEntryDto,
  SavedMealCreateDto,
  SavedMealLogDto,
  SavedMealUpdateDto,
  SearchQueryDto,
  UpdateEntryDto,
  WaterDto,
} from './nutrition.dto';
import { ProfileService } from './profile.service';
import { RecipesService } from './recipes.service';
import { SavedMealsService } from './saved-meals.service';

/** NutriFer: alimentos, diario de comidas, comidas guardadas, recetas, agua y meta. */
@Controller('nutrition')
@UseGuards(JwtAuthGuard)
export class NutritionController {
  constructor(
    private foods: FoodsService,
    private diary: DiaryService,
    private profiles: ProfileService,
    private saved: SavedMealsService,
    private recipes: RecipesService,
  ) {}

  /* ---------- Alimentos ---------- */

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

  /** Lo que sale al abrir una comida: comidas guardadas, favoritos y lo que más anotas ahí. */
  @Get('shortcuts')
  async shortcuts(@CurrentUser() user: AuthUserPayload, @Query() query: SearchQueryDto) {
    const [foods, savedMeals] = await Promise.all([this.foods.shortcuts(user.userId, query.meal), this.saved.list(user.userId, query.meal)]);
    return { ...foods, savedMeals };
  }

  @Get('favorites')
  favorites(@CurrentUser() user: AuthUserPayload) {
    return this.foods.favorites(user.userId);
  }

  @Put('favorites/:foodId')
  addFavorite(@CurrentUser() user: AuthUserPayload, @Param('foodId') foodId: string) {
    return this.foods.setFavorite(user.userId, foodId, true);
  }

  @Delete('favorites/:foodId')
  removeFavorite(@CurrentUser() user: AuthUserPayload, @Param('foodId') foodId: string) {
    return this.foods.setFavorite(user.userId, foodId, false);
  }

  /* ---------- Diario ---------- */

  @Get('day')
  day(@CurrentUser() user: AuthUserPayload, @Query() query: DayQueryDto) {
    return this.diary.day(user.userId, query.date);
  }

  @Post('entries')
  addEntry(@CurrentUser() user: AuthUserPayload, @Body() dto: CreateEntryDto) {
    return this.diary.add(user.userId, dto);
  }

  @Post('entries/quick')
  addQuick(@CurrentUser() user: AuthUserPayload, @Body() dto: QuickEntryDto) {
    return this.diary.addQuick(user.userId, dto);
  }

  /** Borrar varias (deshacer lo recién agregado o vaciar una comida). */
  @Post('entries/remove')
  removeEntries(@CurrentUser() user: AuthUserPayload, @Body() dto: RemoveEntriesDto) {
    return this.diary.removeMany(user.userId, dto.ids);
  }

  @Post('entries/:id/repeat')
  repeatEntry(@CurrentUser() user: AuthUserPayload, @Param('id') id: string, @Body() dto: RepeatEntryDto) {
    return this.diary.repeat(user.userId, id, dto);
  }

  @Patch('entries/:id')
  updateEntry(@CurrentUser() user: AuthUserPayload, @Param('id') id: string, @Body() dto: UpdateEntryDto) {
    return this.diary.update(user.userId, id, dto);
  }

  @Delete('entries/:id')
  removeEntry(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.diary.remove(user.userId, id);
  }

  /** Copiar una comida o el día entero a otro día. */
  @Post('copy')
  copy(@CurrentUser() user: AuthUserPayload, @Body() dto: CopyDto) {
    return this.diary.copy(user.userId, dto);
  }

  @Post('water')
  water(@CurrentUser() user: AuthUserPayload, @Body() dto: WaterDto) {
    return this.diary.addWater(user.userId, dto);
  }

  /* ---------- Comidas guardadas ---------- */

  @Get('saved-meals')
  savedMeals(@CurrentUser() user: AuthUserPayload, @Query() query: SearchQueryDto) {
    return this.saved.list(user.userId, query.meal);
  }

  @Post('saved-meals')
  createSavedMeal(@CurrentUser() user: AuthUserPayload, @Body() dto: SavedMealCreateDto) {
    return this.saved.create(user.userId, dto);
  }

  @Patch('saved-meals/:id')
  updateSavedMeal(@CurrentUser() user: AuthUserPayload, @Param('id') id: string, @Body() dto: SavedMealUpdateDto) {
    return this.saved.update(user.userId, id, dto);
  }

  @Delete('saved-meals/:id')
  removeSavedMeal(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.saved.remove(user.userId, id);
  }

  @Post('saved-meals/:id/log')
  logSavedMeal(@CurrentUser() user: AuthUserPayload, @Param('id') id: string, @Body() dto: SavedMealLogDto) {
    return this.saved.log(user.userId, id, dto);
  }

  /* ---------- Recetas ---------- */

  @Get('recipes')
  recipesList(@CurrentUser() user: AuthUserPayload) {
    return this.recipes.list(user.userId);
  }

  @Get('recipes/:id')
  recipe(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.recipes.get(user.userId, id);
  }

  @Post('recipes')
  createRecipe(@CurrentUser() user: AuthUserPayload, @Body() dto: RecipeDto) {
    return this.recipes.save(user.userId, dto);
  }

  @Put('recipes/:id')
  updateRecipe(@CurrentUser() user: AuthUserPayload, @Param('id') id: string, @Body() dto: RecipeDto) {
    return this.recipes.save(user.userId, dto, id);
  }

  @Delete('recipes/:id')
  removeRecipe(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.recipes.remove(user.userId, id);
  }

  /* ---------- Meta ---------- */

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
