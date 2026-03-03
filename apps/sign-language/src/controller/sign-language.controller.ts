import { Controller, Get } from '@nestjs/common';
import { SignLanguageService } from '../service/sign-language.service';
import { MessagePattern, Payload } from '@nestjs/microservices';

@Controller()
export class SignLanguageController {
  constructor(private readonly signLanguageService: SignLanguageService) { }

  @MessagePattern('gesture_code.postUrlMedia')
  async getGestureCode(@Payload() payload: { urlMedia: string }) {
    const urlMedia = payload.urlMedia
    console.log("Vao duoc controler")
    return this.signLanguageService.getGestureCode(urlMedia)
  }

  @MessagePattern('gesture_code.getGestureWordCode')
  async getGestureWordCode(@Payload() payload: { videoUrl: string }) {
    var videoUrl = payload.videoUrl
    console.log("videoUrl trong controller ", videoUrl)
    return this.signLanguageService.getGestureWordCode(videoUrl);
  }

  @MessagePattern('gesture_code.getSignLanguageVideoPlaylist')
  async getSignLanguageVideoPlaylist(@Payload() payload: { text: string }) {
    var text = payload.text
    console.log("text trong controller ", payload)
    return this.signLanguageService.getSignLanguageVideoPlaylist(text);
  }
}
