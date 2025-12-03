import { Controller, Post, Body, Get } from '@nestjs/common';
import { UndertheseaService } from '../service/underthesea.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ClassificationResult } from '../core/dto/underthesea.dto';

interface ClassifyRequest {
  text: string;
}

@Controller()
export class UndertheseaController {
  constructor(private classificationService: UndertheseaService) { }

  @MessagePattern('underthesea.pos')
  async classifyPOS(@Payload() body: ClassifyRequest): Promise<ClassificationResult> {
    return this.classificationService.classifyPOS(body.text);
  }

  @MessagePattern('underthesea.tokenize')
  async tokenize(@Payload() body: ClassifyRequest) {
    return this.classificationService.tokenize(body.text);
  }

  @MessagePattern('underthesea.classify')
  async classifyText(@Payload() body: ClassifyRequest) {
    return this.classificationService.classifyText(body.text);
  }

  @MessagePattern('underthesea.health')
  async health() {
    return this.classificationService.checkHealth();
  }
}