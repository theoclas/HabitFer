import { Module } from '@nestjs/common';
import { DiaryService } from './diary.service';
import { FoodsService } from './foods.service';
import { NutritionController } from './nutrition.controller';
import { ProfileService } from './profile.service';

@Module({
  controllers: [NutritionController],
  providers: [FoodsService, DiaryService, ProfileService],
  exports: [FoodsService, DiaryService],
})
export class NutritionModule {}
