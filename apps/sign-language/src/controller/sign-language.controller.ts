import { Controller, Get } from '@nestjs/common';
import { SignLanguageService } from '../service/sign-language.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { SentenceToken } from 'apps/sign-language/core/schema/sentencetoken.schema';

@Controller()
export class SignLanguageController {
  constructor(private readonly signLanguageService: SignLanguageService) {}

  @MessagePattern('gesture_code.postUrlMedia')
  async getGestureCode(@Payload() payload: { urlMedia: string }) {
    const urlMedia = payload.urlMedia;
    console.log('Vao duoc controler');
    return this.signLanguageService.getGestureCode(urlMedia);
  }

  @MessagePattern('gesture_code.getGestureWordCode')
  async getGestureWordCode(@Payload() payload: { videoUrl: string }) {
    var videoUrl = payload.videoUrl;
    console.log('videoUrl trong controller ', videoUrl);
    return this.signLanguageService.getGestureWordCode(videoUrl);
  }

  @MessagePattern('gesture_code.getSignLanguageVideoPlaylist')
  async getSignLanguageVideoPlaylist(
    @Payload() payload: { text?: string; tokens?: SentenceToken[] },
  ) {
    console.log('payload trong controller:', payload);
    return this.signLanguageService.getSignLanguageVideoPlaylist(
      payload.tokens ?? payload.text,
    );
  }

  @MessagePattern('gesture_code.completeSentence')
  async completeSentence(@Payload() payload: { tokens: string[] }) {
    console.log('payload trong controller ', payload);
    return this.signLanguageService.complete_sentence(payload.tokens);
  }

  @MessagePattern('gesture_code.bestMatchSentence')
  async bestMatchSentence(@Payload() payload: { tokens: SentenceToken[] }) {
    console.log('payload trong controller ', payload);
    return this.signLanguageService.best_match_sentence(payload.tokens);
  }

  @MessagePattern('gesture_code.reorderSentence')
  async reorderTokens(@Payload() payload: { tokens: string[] }) {
    console.log('payload trong controller ', payload);
    return this.signLanguageService.reorder_tokens(payload.tokens);
  }
  @MessagePattern('gesture_code.processsentence')
  async processSentence(@Payload() payload: { text: SentenceToken[] }) {
    console.log('payload trong controller ', payload);
    return this.signLanguageService.process_sentence(payload.text);
  }
}
