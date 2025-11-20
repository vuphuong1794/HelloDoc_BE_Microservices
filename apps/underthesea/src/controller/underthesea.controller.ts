import { Controller, Post, Body, Get } from '@nestjs/common';
import { ClassificationResult, UndertheseaService } from '../service/underthesea.service';

interface ClassifyRequest {
  text: string;
}

@Controller('api/classification')
export class UndertheseaController {
  constructor(private classificationService: UndertheseaService) { }

  @Post('pos')
  async classifyPOS(@Body() body: ClassifyRequest): Promise<ClassificationResult> {
    return this.classificationService.classifyPOS(body.text);
  }

  @Post('tokenize')
  async tokenize(@Body() body: ClassifyRequest) {
    return this.classificationService.tokenize(body.text);
  }

  @Post('classify')
  async classifyText(@Body() body: ClassifyRequest) {
    return this.classificationService.classifyText(body.text);
  }

  @Get('health')
  async health() {
    return this.classificationService.checkHealth();
  }
}