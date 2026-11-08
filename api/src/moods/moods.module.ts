import { Module } from '@nestjs/common';
import { MoodsController } from './moods.controller';
import { MoodsService } from './moods.service';

@Module({
  controllers: [MoodsController],
  providers: [MoodsService],
})
export class MoodsModule {}
