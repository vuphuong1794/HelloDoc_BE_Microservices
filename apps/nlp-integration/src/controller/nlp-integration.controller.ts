import { Controller } from '@nestjs/common';
import { NlpIntegrationService } from '../service/nlp-integration.service';
import { MessagePattern, Payload } from '@nestjs/microservices';

@Controller()
export class NlpIntegrationController {
  constructor(private readonly nlpIntegrationService: NlpIntegrationService) { }

  // Phân tích văn bản và tạo graph
  @MessagePattern('nlp-integration.analyze')
  async analyzeText(@Payload() payload: any) {
    const { text, createRelations } = payload;
    return this.nlpIntegrationService.analyzeAndCreateGraph(text, createRelations);
  }

  // Phân tích văn bản và tạo semantic graph
  @MessagePattern('nlp-integration.analyze-semantic')
  async analyzeSemanticText(@Payload() text: string) {
    console.log('Received text for semantic analysis:', text);
    return this.nlpIntegrationService.analyzeAndCreateSemanticGraph(text);
  }

  // Xây dựng knowledge graph từ nhiều văn bản
  @MessagePattern('nlp-integration.build-knowledge-graph')
  async buildKnowledgeGraph(@Payload() texts: string[]) {
    if (!Array.isArray(texts)) {
      return { error: 'texts phải là một mảng' };
    }
    if (texts.length === 0) {
      return { error: 'texts không được rỗng' };
    }
    return this.nlpIntegrationService.buildKnowledgeGraph(texts);
  }
}