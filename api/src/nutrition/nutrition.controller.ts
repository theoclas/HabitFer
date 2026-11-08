import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Put, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, type AuthUserPayload } from '../common/decorators/current-user.decorator';
import { DiaryService } from './diary.service';
import { FoodsService } from './foods.service';
import {
  BatchEntriesDto,
  CopyDto,
  CreateEntryDto,
  CreateFoodDto,
  DayQueryDto,
  OffSearchDto,
  PhotoDto,
  ProfileDto,
  QuickEntryDto,
  RangeQueryDto,
  RecipeDto,
  RemoveEntriesDto,
  RepeatEntryDto,
  SavedMealCreateDto,
  SavedMealLogDto,
  SavedMealUpdateDto,
  SearchQueryDto,
  UnderstandDto,
  UpdateEntryDto,
  WaterDto,
  WeightDto,
  WeightsQueryDto,
} from './nutrition.dto';
import { MealPhotosService } from './meal-photos.service';
import { BarcodeService } from './packaged/barcode.service';
import { EnergyService } from './progress/energy.service';
import { ProgressService } from './progress/progress.service';
import { WeightService } from './progress/weight.service';
import { ProfileService } from './profile.service';
import { RecipesService } from './recipes.service';
import { SavedMealsService } from './saved-meals.service';
import { FoodTextService } from './text/food-text.service';

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
    private text: FoodTextService,
    private photos: MealPhotosService,
    private barcodes: BarcodeService,
    private weights: WeightService,
    private energy: EnergyService,
    private progress: ProgressService,
  ) {}

  /* ---------- Peso, informe, descubrimientos y gasto real ---------- */

  /** Pesadas con su tendencia (days = días hacia atrás; 3.650 = todo). */
  @Get('weights')
  weightList(@CurrentUser() user: AuthUserPayload, @Query() query: WeightsQueryDto) {
    return this.weights.list(user.userId, query.days ?? 90);
  }

  @Put('weights/:date')
  weightSet(@CurrentUser() user: AuthUserPayload, @Param('date') date: string, @Body() dto: WeightDto) {
    return this.weights.set(user.userId, date, dto.kg);
  }

  @Delete('weights/:date')
  weightRemove(@CurrentUser() user: AuthUserPayload, @Param('date') date: string) {
    return this.weights.remove(user.userId, date);
  }

  /** Llave nueva para el atajo de iOS (Apple Salud); se muestra una sola vez. */
  @Post('shortcut')
  shortcutCreate(@CurrentUser() user: AuthUserPayload) {
    return this.weights.createShortcut(user.userId);
  }

  @Delete('shortcut')
  shortcutRemove(@CurrentUser() user: AuthUserPayload) {
    return this.weights.removeShortcut(user.userId);
  }

  /** Informe de un periodo: cada día, promedios, días en meta, por comida y lo que más aportó. */
  @Get('progress')
  report(@CurrentUser() user: AuthUserPayload, @Query() query: RangeQueryDto) {
    return this.progress.report(user.userId, query.from, query.to);
  }

  /** Descubrimientos de las últimas 4 semanas y cómo va la medición del gasto real. */
  @Get('insights')
  async insights(@CurrentUser() user: AuthUserPayload) {
    const [discoveries, energy] = await Promise.all([this.progress.discoveries(user.userId), this.energy.view(user.userId)]);
    return { discoveries, energy };
  }

  /* ---------- Código de barras y empacados (Open Food Facts) ---------- */

  /** Código de barras → alimento (de la base o de Open Food Facts, que se guarda). */
  @Get('barcode/:code')
  barcode(@CurrentUser() user: AuthUserPayload, @Param('code') code: string) {
    return this.barcodes.lookup(user.userId, code);
  }

  /** Empacados colombianos por nombre o marca en Open Food Facts. */
  @Get('off/search')
  offSearch(@CurrentUser() user: AuthUserPayload, @Query() query: OffSearchDto) {
    return this.barcodes.search(user.userId, query.q);
  }

  /** Guardar un producto de Open Food Facts que salió en la búsqueda (por su código). */
  @Post('off/:code')
  offSave(@CurrentUser() user: AuthUserPayload, @Param('code') code: string) {
    return this.barcodes.lookup(user.userId, code);
  }

  /* ---------- Escribe o dicta (sin IA) y fotos para después ---------- */

  /** Entiende el texto y propone qué y cuánto; no guarda nada. */
  @Post('understand')
  understand(@CurrentUser() user: AuthUserPayload, @Body() dto: UnderstandDto) {
    return this.text.understand(user.userId, dto.text);
  }

  /** Guarda de una vez lo confirmado (y aprende los nombres corregidos). */
  @Post('entries/batch')
  addMany(@CurrentUser() user: AuthUserPayload, @Body() dto: BatchEntriesDto) {
    return this.diary.addMany(user.userId, dto);
  }

  @Post('photos')
  addPhoto(@CurrentUser() user: AuthUserPayload, @Body() dto: PhotoDto) {
    return this.photos.create(user.userId, dto);
  }

  @Get('photos/:id')
  @Header('Cache-Control', 'private, max-age=86400')
  async photo(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    const p = await this.photos.file(user.userId, id);
    return new StreamableFile(Buffer.from(p.data), { type: p.mime });
  }

  @Delete('photos/:id')
  removePhoto(@CurrentUser() user: AuthUserPayload, @Param('id') id: string) {
    return this.photos.remove(user.userId, id);
  }

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

  /** La meta que saldría con estos datos, sin guardar (con el gasto medido de la semana, si lo hay). */
  @Post('profile/preview')
  preview(@CurrentUser() user: AuthUserPayload, @Body() dto: ProfileDto) {
    return this.profiles.preview(user.userId, dto);
  }
}
