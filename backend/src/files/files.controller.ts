import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { FilesService } from './files.service';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Throttle({
    short: { limit: 5, ttl: 1000 },
    medium: { limit: 20, ttl: 10000 },
  }) // 5 por segundo, 20 por 10 segundos
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('productRef') productRef?: string,
    @Body('assetType') assetType?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // Validar tipo de archivo (opcional pero recomendado)
    if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
      throw new BadRequestException('Only image files are allowed!');
    }

    const result = (await this.filesService.uploadImage(
      file,
      productRef,
      assetType ?? 'gallery',
    )) as {
      secure_url: string;
      public_id: string;
    };
    return {
      url: result.secure_url,
      public_id: result.public_id,
    };
  }
}
