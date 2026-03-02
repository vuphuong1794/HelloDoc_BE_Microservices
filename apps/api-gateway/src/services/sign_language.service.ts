import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SignLanguageService {
    private readonly logger = new Logger(SignLanguageService.name)

    constructor(
        @Inject('SIGNLANGUAGE_CLIENT') private readonly signClient: ClientProxy
    ) { }

    async postVideoUrl(videoUrl: string) {
        console.log("videoUrl ", videoUrl)
        if (!videoUrl) {
            throw new BadRequestException('Cần cung cấp url');
        }
        console.log("Chạy được service")

        return this.signClient.send('gesture_code.getGestureWordCode', { videoUrl: videoUrl })

    }

    async getGestureWordCode(videoUrl: string) {
        console.log("videoUrl trong service ", videoUrl)
        if (!videoUrl) {
            throw new BadRequestException('Cần cung cấp url');
        }
        return this.signClient.send('gesture_code.getGestureWordCode', { videoUrl: videoUrl })
    }

    async getSignLanguageVideoPlaylist(text: string) {
        console.log("text trong service ", text)
        if (!text) {
            throw new BadRequestException('Cần cung cấp text');
        }
        return this.signClient.send('gesture_code.getSignLanguageVideoPlaylist', { text: text })
    }
}