import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Res,
  HttpStatus,
  Param,
  HttpException,
} from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { Response } from 'express';
import { SignLanguageService } from '../services/sign_language.service';
import { SentenceToken } from 'apps/sign-language/core/schema/sentencetoken.schema';

@Controller('gesture_code')
export class SignLanguageController {
  constructor(private readonly signLanguageService: SignLanguageService) {}

  @Post('post_video_url')
  async postVideoUrl(@Body() urlMedia: string) {
    return this.signLanguageService.postVideoUrl(urlMedia);
  }

  @Get('get_gesture_code')
  async getGestureWordCode(@Query('videoUrl') videoUrl: string) {
    console.log('videoUrl nhận được là', videoUrl);
    return this.signLanguageService.getGestureWordCode(videoUrl);
  }

  @Post('get_sign_language_video_playlist')
  async getSignLanguageVideoPlaylist(
    @Body() body: { text?: string; tokens?: SentenceToken[] } | SentenceToken[],
  ) {
    console.log('body nhận được:', JSON.stringify(body));

    // Raw array: [["tôi"], ["ăn"], ...]
    if (Array.isArray(body)) {
      return this.signLanguageService.getSignLanguageVideoPlaylist(body);
    }

    // Object: { "tokens": [...] }
    if (body.tokens && Array.isArray(body.tokens)) {
      return this.signLanguageService.getSignLanguageVideoPlaylist(body.tokens);
    }

    if (body.text && typeof body.text === 'string') {
      return this.signLanguageService.getSignLanguageVideoPlaylist(body.text);
    }

    throw new HttpException(
      'Phải cung cấp "text" hoặc "tokens"',
      HttpStatus.BAD_REQUEST,
    );
  }
}
