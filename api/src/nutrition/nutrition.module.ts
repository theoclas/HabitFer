import { Module } from '@nestjs/common';
import { HabitsModule } from '../habits/habits.module';
import { PushModule } from '../push/push.module';
import { AgentKeysService } from './assistant/agent-keys.service';
import {
  NutritionAgentController,
  NutritionAssistantController,
} from './assistant/assistant.controller';
import { AssistantService } from './assistant/assistant.service';
import { DiaryService } from './diary.service';
import { NutritionExportService } from './export/nutrition-export.service';
import { FastingService } from './fasting/fasting.service';
import { FoodsService } from './foods.service';
import { NutriHabitsService } from './habits/nutri-habits.service';
import { MealPhotosService } from './meal-photos.service';
import { NutritionController } from './nutrition.controller';
import { BarcodeService } from './packaged/barcode.service';
import { OpenFoodFactsClient } from './packaged/open-food-facts.client';
import { MealPlanService } from './plan/meal-plan.service';
import { EnergyService } from './progress/energy.service';
import { ProgressService } from './progress/progress.service';
import { NutritionShortcutController } from './progress/shortcut.controller';
import { WeightService } from './progress/weight.service';
import { ProfileService } from './profile.service';
import { RecipesService } from './recipes.service';
import { SavedMealsService } from './saved-meals.service';
import { NutritionSuperController } from './super.controller';
import { FoodTextService } from './text/food-text.service';

@Module({
  imports: [HabitsModule, PushModule],
  controllers: [
    NutritionController,
    NutritionShortcutController,
    NutritionSuperController,
    NutritionAgentController,
    NutritionAssistantController,
  ],
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
    NutriHabitsService,
    FastingService,
    MealPlanService,
    NutritionExportService,
    AgentKeysService,
    AssistantService,
  ],
  exports: [FoodsService, DiaryService, NutritionExportService],
})
export class NutritionModule {}
