import { Controller, Get, Param, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { VideoService } from './video.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { createReadStream } from 'fs';
import { Response } from 'express';

@Controller('video')
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + extname(file.originalname));
      }
    }),
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.startsWith('video/')) {
        return cb(new Error('Only video files are allowed'), false);
      }
      cb(null, true);
    },
    limits: { fileSize: 1024 * 1024 * 1000 },
  }))
  async uploadVideo(@UploadedFile() file: Express.Multer.File) {
    await this.videoService.processVideo(file.path);
    return {
      filename: file.filename,
      path: file.path,
    }
  }

  @Get('stream/:filename')
  async streamVideo(@Param('filename') filename: string, @Res() res: Response) {
    const videoPath = join(process.cwd(), 'uploads', filename);
    const stat = await this.videoService.getVideoStat(videoPath);
    const fileSize = stat.size;
    const range = res.req.headers.range;

    if (range) {
      // 스트리밍(부분 전송) 지원
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      const file = createReadStream(videoPath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'video/mp4',
      });
      file.pipe(res);
    } else {
      // 전체 파일 전송
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      });
      createReadStream(videoPath).pipe(res);
    }
  }
}
