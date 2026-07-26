import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Request,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { APP_DEFAULTS } from '../shared/app.constants';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { VIDEO_HTTP, VIDEO_MESSAGES } from './video.constants';
import { VideoService } from './video.service';

type UploadFile = {
  originalname?: string;
  filename?: string;
  path?: string;
  size?: number;
  buffer?: Buffer;
};

const MAX_VIDEO_SIZE_BYTES = APP_DEFAULTS.maxVideoSizeBytes;

@ApiTags('videos')
@Controller('videos')
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Enviar video para processamento' })
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Arquivo de video para processamento (maximo: 50 MB)',
        },
      },
    },
  })
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: MAX_VIDEO_SIZE_BYTES,
      },
    }),
  )
  upload(@UploadedFile() file: UploadFile, @Request() req: any) {
    return this.videoService.upload(req.user.id, file);
  }

  @Get('jobs')
  @ApiOperation({ summary: 'Listar jobs de video do usuario autenticado' })
  @ApiBearerAuth()
  @ApiQuery({ name: 'page', required: false, example: '1' })
  @ApiQuery({ name: 'limit', required: false, example: '10' })
  @UseGuards(JwtAuthGuard)
  list(
    @Request() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    return this.videoService.list(req.user.id, Number(page), Number(limit));
  }

  @Get('download/:jobId')
  @ApiOperation({ summary: 'Baixar ZIP de frames processados por jobId' })
  @ApiBearerAuth()
  @ApiParam({ name: 'jobId', example: 'job_123' })
  @UseGuards(JwtAuthGuard)
  async download(
    @Param('jobId') jobId: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const filePath = await this.videoService.download(jobId, req.user.id);
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: VIDEO_MESSAGES.fileNotFound });
    }
    return res.download(filePath);
  }

  @Get('watch/:jobId')
  @ApiOperation({ summary: 'Assistir arquivo original enviado por jobId' })
  @ApiBearerAuth()
  @ApiParam({ name: 'jobId', example: 'job_123' })
  @UseGuards(JwtAuthGuard)
  async watch(
    @Param('jobId') jobId: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const filePath = await this.videoService.watch(jobId, req.user.id);
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: VIDEO_MESSAGES.fileNotFound });
    }
    res.setHeader(VIDEO_HTTP.contentDispositionHeader, VIDEO_HTTP.inline);
    return res.sendFile(path.resolve(filePath));
  }

  @Delete('jobs/:jobId')
  @ApiOperation({ summary: 'Excluir job de video do usuario autenticado' })
  @ApiBearerAuth()
  @ApiParam({ name: 'jobId', example: 'job_123' })
  @UseGuards(JwtAuthGuard)
  remove(@Param('jobId') jobId: string, @Request() req: any) {
    return this.videoService.remove(jobId, req.user.id);
  }
}
