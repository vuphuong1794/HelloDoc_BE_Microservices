import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { firstValueFrom } from "rxjs";

@Injectable()
export class NlpIntegrationService {
    constructor(
        @Inject('NLP_CLIENT') private readonly nlpClient: ClientProxy,
    ) { }

    async analyzeAndCreateGraph(text: string, createRelations: boolean = true) {
        return firstValueFrom(
            this.nlpClient.send('nlp-integration.analyze', { text, createRelations })
        );
    }

    async analyzeAndCreateSemanticGraph(text: string) {
        return firstValueFrom(
            this.nlpClient.send('nlp-integration.analyze-semantic', text)
        );
    }

    async buildKnowledgeGraph(texts: string[]) {
        return firstValueFrom(
            this.nlpClient.send('nlp-integration.build-knowledge-graph', texts)
        );
    }
}