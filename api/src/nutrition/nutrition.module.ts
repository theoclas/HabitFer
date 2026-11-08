import { Module } from '@nestjs/common';
import { DiaryService } from './diary.service';
import { FoodsService } from './foods.service';
import { NutritionController } from './nutrition.controller';
import { ProfileService } from './profile.service';
import { RecipesService } from './recipes.service';
import { SavedMealsService } from './saved-meals.service';

@Module({
  controllers: [NutritionController],
  providers: [FoodsService, DiaryService, ProfileService, SavedMealsService, RecipesService],
  exports: [FoodsService, DiaryService],
})
export class NutritionModule {}
