import { Module } from '@nestjs/common';
import { DiaryService } from './diary.service';
import { FoodsService } from './foods.service';
import { MealPhotosService } from './meal-photos.service';
import { NutritionController } from './nutrition.controller';
import { BarcodeService } from './packaged/barcode.service';
import { OpenFoodFactsClient } from './packaged/open-food-facts.client';
import { EnergyService } from './progress/energy.service';
import { ProgressService } from './progress/progress.service';
import { NutritionShortcutController } from './progress/shortcut.controller';
import { WeightService } from './progress/weight.service';
import { ProfileService } from './profile.service';
import { RecipesService } from './recipes.service';
import { SavedMealsService } from './saved-meals.service';
import { FoodTextService } from './text/food-text.service';

@Module({
  controllers: [NutritionController, NutritionShortcutController],
  providers: [
    FoodsService,
    DiaryService,
    ProfileService,
    SavedMealsService,
    RecipesService,
    FoodTextService,
    MealPhotosService,
    OpenFoodFactsClient,
    BarcodeService,
    WeightService,
    EnergyService,
    ProgressService,
  ],
  exports: [FoodsService, DiaryService],
})
export class NutritionModule {}
