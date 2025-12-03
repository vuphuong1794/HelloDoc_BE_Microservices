import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { NlpIntegrationService } from '../services/nlp-integration.service';

@Controller('nlp')
export class NlpController {
    constructor(private readonly nlpService: NlpIntegrationService) { }

    // Phân tích văn bản và tạo graph đơn giản
    @Post('analyze')
    async analyzeText(
        @Body('text') text: string,
        @Body('createRelations') createRelations?: boolean,
    ) {
        if (!text) {
            return { error: 'Thiếu tham số text' };
        }
        return await this.nlpService.analyzeAndCreateGraph(text, createRelations ?? true);
    }

    /**
     * Phân tích văn bản và tạo semantic graph (có quan hệ ngữ nghĩa)
     * 
     * Ví dụ: "Sinh viên học bài tập khó"
     * Sẽ tạo các quan hệ như:
     * - Sinh viên (N) --SUBJECT_OF--> học (V)
     * - học (V) --HAS_OBJECT--> bài tập (N)
     * - khó (A) --MODIFIES--> bài tập (N)
     */
    @Post('analyze-semantic')
    async analyzeSemanticText(@Body('text') text: string) {
        if (!text) {
            return { error: 'Thiếu tham số text' };
        }
        return await this.nlpService.analyzeAndCreateSemanticGraph(text);
    }

    /**
     * Xây dựng knowledge graph từ nhiều văn bản
     * 
     * Sử dụng để xây dựng knowledge graph từ corpus lớn.
     * Weight sẽ tự động tăng khi các mối quan hệ xuất hiện nhiều lần.
     */
    @Post('build-knowledge-graph')
    async buildKnowledgeGraph(@Body('texts') texts: string[]) {
        if (!Array.isArray(texts)) {
            return { error: 'texts phải là một mảng' };
        }
        if (texts.length === 0) {
            return { error: 'texts không được rỗng' };
        }
        return await this.nlpService.buildKnowledgeGraph(texts);
    }

}