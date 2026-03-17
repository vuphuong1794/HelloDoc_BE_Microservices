import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { SentenceToken } from 'apps/sign-language/core/schema/sentencetoken.schema';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SignLanguageService {
  private readonly logger = new Logger(SignLanguageService.name);

  constructor(
    @Inject('SIGNLANGUAGE_CLIENT') private readonly signClient: ClientProxy,
  ) {}

  async postVideoUrl(videoUrl: string) {
    console.log('videoUrl ', videoUrl);
    if (!videoUrl) {
      throw new BadRequestException('Cần cung cấp url');
    }
    console.log('Chạy được service');

    return this.signClient.send('gesture_code.getGestureWordCode', {
      videoUrl: videoUrl,
    });
  }

  async getGestureWordCode(videoUrl: string) {
    console.log('videoUrl trong service ', videoUrl);
    if (!videoUrl) {
      throw new BadRequestException('Cần cung cấp url');
    }
    return this.signClient.send('gesture_code.getGestureWordCode', {
      videoUrl: videoUrl,
    });
  }

  async getSignLanguageVideoPlaylist(input: string | SentenceToken[]) {
    console.log('input trong gateway service:', input);

    if (!input || (Array.isArray(input) && input.length === 0)) {
      throw new BadRequestException('Cần cung cấp "text" hoặc "tokens"');
    }

    // Gửi đúng field tương ứng
    const payload = Array.isArray(input) ? { tokens: input } : { text: input };

    return firstValueFrom(
      this.signClient.send(
        'gesture_code.getSignLanguageVideoPlaylist',
        payload,
      ),
    );
  }
}
