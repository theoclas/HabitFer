import { Module } from '@nestjs/common';
import { DiaryService } from './diary.service';
import { FoodsService } from './foods.service';
import { MealPhotosService } from './meal-photos.service';
import { NutritionController } from './nutrition.controller';
import { ProfileService } from './profile.service';
import { RecipesService } from './recipes.service';
import { SavedMealsService } from './saved-meals.service';
import { FoodTextService } from './text/food-text.service';

@Module({
  controllers: [NutritionController],
  providers: [FoodsService, DiaryService, ProfileService, SavedMealsService, RecipesService, FoodTextService, MealPhotosService],
  exports: [FoodsService, DiaryService],
})
export class NutritionModule {}
