import { Module } from '@nestjs/common';
import { NutritionModule } from '../nutrition/nutrition.module';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';

@Module({
  imports: [NutritionModule],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}
