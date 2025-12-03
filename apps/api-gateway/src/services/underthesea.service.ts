import { Body, Inject, Injectable } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { ClassificationResult } from "../core/dto/underthesea.dto";

interface ClassifyRequest {
    text: string;
}

@Injectable()
export class UndertheseaService {
    constructor(
        @Inject('UNDERTHESEA_CLIENT') private readonly undertheseaClient: ClientProxy,
    ) { }

    async classifyPOS(body: ClassifyRequest) {
        return this.undertheseaClient.send('underthesea.pos', { text: body.text });
    }

    async tokenize(body: ClassifyRequest) {
        return this.undertheseaClient.send('underthesea.tokenize', { text: body.text });
    }

    async classifyText(body: ClassifyRequest) {
        return this.undertheseaClient.send('underthesea.classify', { text: body.text });
    }

    async checkHealth() {
        return this.undertheseaClient.send('underthesea.health', {});
    }
}