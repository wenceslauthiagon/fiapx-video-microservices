import { Controller, Get, Param, Post, Query, Request, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as fs from 'node:fs';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { VideoService } from './video.service';

@Controller('videos')
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file: Express.Multer.File, @Request() req: any) {
    return this.videoService.upload(req.user.id, file);
  }

  @Get('jobs')
  @UseGuards(JwtAuthGuard)
  list(@Request() req: any, @Query('page') page = '1', @Query('limit') limit = '10') {
    return this.videoService.list(req.user.id, Number(page), Number(limit));
  }

  @Get('download/:jobId')
  @UseGuards(JwtAuthGuard)
  async download(@Param('jobId') jobId: string, @Request() req: any, @Res() res: Response) {
    const filePath = await this.videoService.download(jobId, req.user.id);
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    return res.download(filePath);
  }
}
