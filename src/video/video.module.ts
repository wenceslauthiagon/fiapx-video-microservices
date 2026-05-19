import { Module } from '@nestjs/common';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { VideoController } from './video.controller';
import { VideoService } from './video.service';

@Module({
  controllers: [VideoController],
  providers: [VideoService, PrismaService],
})
export class VideoModule {}
