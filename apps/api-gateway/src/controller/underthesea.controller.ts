import { Controller, Post, Body, Get } from '@nestjs/common';
import { UndertheseaService } from '../services/underthesea.service';
import { ClassificationResult } from '../core/dto/underthesea.dto';

interface ClassifyRequest {
    text: string;
}

@Controller('api/classification')
export class UndertheseaController {
    constructor(private undertheseaService: UndertheseaService) { }

    @Post('pos')
    async classifyPOS(@Body() body: ClassifyRequest) {
        return this.undertheseaService.classifyPOS(body);
    }

    @Post('tokenize')
    async tokenize(@Body() body: ClassifyRequest) {
        return this.undertheseaService.tokenize(body);
    }

    @Post('classify')
    async classifyText(@Body() body: ClassifyRequest) {
        return this.undertheseaService.classifyText(body);
    }

    @Get('health')
    async health() {
        return this.undertheseaService.checkHealth();
    }
}