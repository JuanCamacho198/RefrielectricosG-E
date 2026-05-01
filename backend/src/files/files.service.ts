import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class FilesService {
  private sanitizePathSegment(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-_]/g, '');
  }

  private buildProductFolder(
    productRef?: string,
    assetType = 'gallery',
  ): string {
    const safeProductRef = this.sanitizePathSegment(productRef || 'general');
    const safeAssetType = this.sanitizePathSegment(assetType || 'gallery');
    return `refrielectricos/products/${safeProductRef}/${safeAssetType}`;
  }

  async uploadImage(
    file: Express.Multer.File,
    productRef?: string,
    assetType = 'gallery',
  ): Promise<UploadApiResponse | UploadApiErrorResponse> {
    const folder = this.buildProductFolder(productRef, assetType);

    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        { folder },
        (error, result) => {
          if (error) return reject(new Error(error.message));
          resolve(result);
        },
      );

      // Convert buffer to stream
      const stream = new Readable();
      stream.push(file.buffer);
      stream.push(null);
      stream.pipe(upload);
    });
  }
}
