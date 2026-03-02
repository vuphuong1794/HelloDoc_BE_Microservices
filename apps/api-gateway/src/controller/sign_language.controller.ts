import { Controller, Get, Post, Body, Query, Res, HttpStatus, Param } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { Response } from 'express';
import { SignLanguageService } from '../services/sign_language.service';

@Controller('gesture_code')
export class SignLanguageController {
  constructor(private readonly signLanguageService: SignLanguageService) { }

  @Post('post_video_url')
  async postVideoUrl(@Body() urlMedia: string) {
    return this.signLanguageService.postVideoUrl(urlMedia);
  }

  @Get('get_gesture_code') 
  async getGestureWordCode(@Query('videoUrl') videoUrl: string) {
    console.log("videoUrl nhận được là", videoUrl);
    return this.signLanguageService.getGestureWordCode(videoUrl);
  }

  @Post('get_sign_language_video_playlist')
  async getSignLanguageVideoPlaylist(@Body('text') text: string) {
    console.log("text nhận được là", text);
    return this.signLanguageService.getSignLanguageVideoPlaylist(text);
  }
}
