import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { VideoModule } from './video/video.module';

const envFilePath =
  process.env.NODE_ENV === 'development'
    ? ['.env.development', '.env']
    : '.env';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath }),
    AuthModule,
    VideoModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
