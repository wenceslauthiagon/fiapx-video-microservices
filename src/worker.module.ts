import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './infrastructure/database/prisma.service';
import { VideoProcessorService } from './video/video-processor.service';

const envFilePath =
  process.env.NODE_ENV === 'development'
    ? ['.env.development', '.env']
    : '.env';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath })],
  providers: [VideoProcessorService, PrismaService],
})
export class WorkerModule {}
