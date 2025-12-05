import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';

export interface CaptionResult {
  caption: string;
  confidence?: number;
}

@Injectable()
export class ImageCaptionService {
  private readonly logger = new Logger(ImageCaptionService.name);

  // Thử các model này theo thứ tự
  private readonly models = [
    'Salesforce/blip-image-captioning-large',
    'nlpconnect/vit-gpt2-image-captioning',
    'microsoft/git-base-coco',
  ];

  private readonly apiToken: string;

  constructor(
    private readonly httpService: HttpService,
  ) {
    this.apiToken = process.env.HF_API_TOKEN;
    if (!this.apiToken) {
      this.logger.warn('HF_API_TOKEN not found in environment variables');
    }
  }

  /**
   * Generate caption từ image buffer
   */
  async generateCaption(imageBuffer: Buffer): Promise<CaptionResult> {
    // Thử từng model cho đến khi có model hoạt động
    for (const model of this.models) {
      try {
        this.logger.log(`Trying model: ${model}`);
        const result = await this.generateCaptionWithModel(imageBuffer, model);
        this.logger.log(`Success with model: ${model}`);
        return result;
      } catch (error) {
        const axiosError = error as AxiosError;
        this.logger.warn(`Model ${model} failed: ${axiosError.message}`);

        // Nếu là model cuối cùng, throw error
        if (model === this.models[this.models.length - 1]) {
          throw error;
        }
        // Nếu không phải model cuối, thử model tiếp theo
        continue;
      }
    }

    throw new Error('All models failed to generate caption');
  }

  /**
   * Generate caption với model cụ thể
   */
  private async generateCaptionWithModel(
    imageBuffer: Buffer,
    modelName: string,
  ): Promise<CaptionResult> {
    const maxRetries = 3;
    const apiUrl = `https://api-inference.huggingface.co/models/${modelName}`;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.log(`Attempt ${attempt}/${maxRetries} for model ${modelName}`);

        const response = await firstValueFrom(
          this.httpService.post(apiUrl, imageBuffer, {
            headers: {
              'Authorization': `Bearer ${this.apiToken}`,
              'Content-Type': 'application/octet-stream',
            },
            timeout: 30000,
          }),
        );

        const result = response.data;
        this.logger.debug(`Response from ${modelName}:`, JSON.stringify(result));

        // Xử lý các format response khác nhau
        if (Array.isArray(result) && result.length > 0) {
          return {
            caption: result[0].generated_text || result[0].caption_text || result[0].text,
            confidence: result[0].score,
          };
        }

        if (result && typeof result === 'object') {
          return {
            caption: result.generated_text || result.caption_text || result.text || result[0],
            confidence: result.score,
          };
        }

        throw new Error(`Invalid response format from ${modelName}: ${JSON.stringify(result)}`);
      } catch (error) {
        lastError = error;
        const axiosError = error as AxiosError;

        if (axiosError.response) {
          const status = axiosError.response.status;
          const data = axiosError.response.data;

          this.logger.error(`API Error ${status} from ${modelName}:`, data);

          // Lỗi 404 - Model không tồn tại
          if (status === 404) {
            throw new Error(`Model ${modelName} not found (404)`);
          }

          // Lỗi 401 - Token không hợp lệ
          if (status === 401 || status === 403) {
            throw new Error('Invalid or missing Hugging Face API token');
          }

          // Lỗi 400 - Dữ liệu không hợp lệ
          if (status === 400) {
            throw new Error('Invalid image format or data');
          }

          // Lỗi 503 hoặc 410 - Model đang loading
          if (status === 503 || status === 410) {
            if (attempt < maxRetries) {
              const waitTime = attempt * 3000; // 3s, 6s, 9s
              this.logger.warn(`Model is loading, waiting ${waitTime}ms before retry...`);
              await this.sleep(waitTime);
              continue;
            }
          }

          // Lỗi 429 - Rate limit
          if (status === 429) {
            if (attempt < maxRetries) {
              const waitTime = 5000 * attempt;
              this.logger.warn(`Rate limited, waiting ${waitTime}ms...`);
              await this.sleep(waitTime);
              continue;
            }
          }
        }

        // Nếu là attempt cuối cùng, throw error
        if (attempt === maxRetries) {
          throw lastError;
        }

        // Chờ trước khi retry
        await this.sleep(1000 * attempt);
      }
    }

    throw lastError;
  }

  /**
   * Generate caption từ URL
   */
  async generateCaptionFromUrl(imageUrl: string): Promise<CaptionResult> {
    try {
      this.logger.log(`Downloading image from: ${imageUrl}`);

      const imageResponse = await firstValueFrom(
        this.httpService.get(imageUrl, {
          responseType: 'arraybuffer',
          timeout: 15000,
          maxContentLength: 10 * 1024 * 1024, // 10MB
        }),
      );

      const buffer = Buffer.from(imageResponse.data);
      this.logger.log(`Image downloaded, size: ${buffer.length} bytes`);

      return this.generateCaption(buffer);
    } catch (error) {
      this.logger.error('Error downloading or processing image:', error.message);
      throw new Error(`Failed to download image: ${error.message}`);
    }
  }

  /**
   * Batch processing - xử lý nhiều ảnh
   */
  async generateCaptionsBatch(imageBuffers: Buffer[]): Promise<CaptionResult[]> {
    this.logger.log(`Processing batch of ${imageBuffers.length} images`);

    const promises = imageBuffers.map((buffer, index) =>
      this.generateCaption(buffer)
        .then(result => {
          this.logger.log(`Image ${index + 1} processed successfully`);
          return result;
        })
        .catch(err => {
          this.logger.error(`Image ${index + 1} failed:`, err.message);
          return {
            caption: '',
            confidence: 0,
            error: err.message,
          } as any;
        })
    );

    return Promise.all(promises);
  }

  /**
   * Helper: Sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}