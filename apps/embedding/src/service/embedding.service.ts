import { Injectable, Logger } from '@nestjs/common';
import { HfInference } from '@huggingface/inference';
import axios from 'axios';

@Injectable()
export class EmbeddingService {
    private readonly logger = new Logger(EmbeddingService.name);
    private hf: HfInference; // Client để gọi Hugging Face API

    // Cấu hình model và embedding
    private readonly embeddingModel = 'BAAI/bge-m3'; // Model tạo embedding
    private readonly embeddingDimensions = 384; // Số chiều của vector embedding
    private readonly maxRetries = 3; // Số lần thử lại khi API lỗi
    private readonly retryDelay = 1000; // Thời gian chờ giữa các lần thử 

    constructor() {
        try {
            this.hf = new HfInference(process.env.HF_API_TOKEN);
            console.log('token la:', process.env.HF_API_TOKEN);

            if (!process.env.HF_API_TOKEN) {
                console.error('❌ HF_API_TOKEN không được set trong environment');
                return;
            }

            this.logger.log('EmbeddingService initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize EmbeddingService:', error);
        }
    }

    /**
     * Chuyển đổi tiếng Việt có dấu sang không dấu
     * Ví dụ: "đau đầu" -> "dau dau"
     */
    private removeVietnameseAccents(text: string): string {
        if (text || typeof text !== 'string') {
            return text;
        }

        // Bảng mapping các ký tự có dấu sang không dấu
        const vietnameseMap: { [key: string]: string } = {
            // Chữ a
            'à': 'a', 'á': 'a', 'ạ': 'a', 'ả': 'a', 'ã': 'a',
            'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ậ': 'a', 'ẩ': 'a', 'ẫ': 'a',
            'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ặ': 'a', 'ẳ': 'a', 'ẵ': 'a',
            'À': 'A', 'Á': 'A', 'Ạ': 'A', 'Ả': 'A', 'Ã': 'A',
            'Â': 'A', 'Ầ': 'A', 'Ấ': 'A', 'Ậ': 'A', 'Ẩ': 'A', 'Ẫ': 'A',
            'Ă': 'A', 'Ằ': 'A', 'Ắ': 'A', 'Ặ': 'A', 'Ẳ': 'A', 'Ẵ': 'A',

            // Chữ e
            'è': 'e', 'é': 'e', 'ẹ': 'e', 'ẻ': 'e', 'ẽ': 'e',
            'ê': 'e', 'ề': 'e', 'ế': 'e', 'ệ': 'e', 'ể': 'e', 'ễ': 'e',
            'È': 'E', 'É': 'E', 'Ẹ': 'E', 'Ẻ': 'E', 'Ẽ': 'E',
            'Ê': 'E', 'Ề': 'E', 'Ế': 'E', 'Ệ': 'E', 'Ể': 'E', 'Ễ': 'E',

            // Chữ i
            'ì': 'i', 'í': 'i', 'ị': 'i', 'ỉ': 'i', 'ĩ': 'i',
            'Ì': 'I', 'Í': 'I', 'Ị': 'I', 'Ỉ': 'I', 'Ĩ': 'I',

            // Chữ o
            'ò': 'o', 'ó': 'o', 'ọ': 'o', 'ỏ': 'o', 'õ': 'o',
            'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ộ': 'o', 'ổ': 'o', 'ỗ': 'o',
            'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ợ': 'o', 'ở': 'o', 'ỡ': 'o',
            'Ò': 'O', 'Ó': 'O', 'Ọ': 'O', 'Ỏ': 'O', 'Õ': 'O',
            'Ô': 'O', 'Ồ': 'O', 'Ố': 'O', 'Ộ': 'O', 'Ổ': 'O', 'Ỗ': 'O',
            'Ơ': 'O', 'Ờ': 'O', 'Ớ': 'O', 'Ợ': 'O', 'Ở': 'O', 'Ỡ': 'O',

            // Chữ u
            'ù': 'u', 'ú': 'u', 'ụ': 'u', 'ủ': 'u', 'ũ': 'u',
            'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ự': 'u', 'ử': 'u', 'ữ': 'u',
            'Ù': 'U', 'Ú': 'U', 'Ụ': 'U', 'Ủ': 'U', 'Ũ': 'U',
            'Ư': 'U', 'Ừ': 'U', 'Ứ': 'U', 'Ự': 'U', 'Ử': 'U', 'Ữ': 'U',

            // Chữ y
            'ỳ': 'y', 'ý': 'y', 'ỵ': 'y', 'ỷ': 'y', 'ỹ': 'y',
            'Ỳ': 'Y', 'Ý': 'Y', 'Ỵ': 'Y', 'Ỷ': 'Y', 'Ỹ': 'Y',

            // Chữ đ
            'đ': 'd', 'Đ': 'D'
        };

        // Thay thế từng ký tự có dấu bằng ký tự không dấu
        let result = text;
        for (const [accented, unaccented] of Object.entries(vietnameseMap)) {
            result = result.replace(new RegExp(accented, 'g'), unaccented);
        }

        return result;
    }

    //Hàm chính để tạo embedding từ text
    async generateEmbedding(text: string): Promise<number[]> {

        // Bước 1: Kiểm tra tính hợp lệ của input
        if (!text || typeof text !== 'string') {
            this.logger.warn('Invalid input for embedding generation');
            return this.createEmptyEmbedding(); // Trả về vector toàn số 0
        }

        const cleanText = text.trim();
        if (cleanText.length === 0) {
            this.logger.warn('Empty text for embedding generation');
            return this.createEmptyEmbedding();
        }

        // Bước 1.5: Chuyển đổi tiếng Việt có dấu sang không dấu
        const normalizedText = this.removeVietnameseAccents(cleanText);
        this.logger.log(`Original text: "${cleanText}" -> Normalized: "${normalizedText}"`);

        // Bước 2: Làm sạch và giới hạn độ dài text để tránh vượt quá limit API
        const maxLength = 500;
        const truncatedText = normalizedText.length > maxLength
            ? normalizedText.substring(0, maxLength) + '...'
            : normalizedText;

        // Bước 3: Thử tạo embedding với retry mechanism
        //for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
            //this.logger.log(`Generating embedding (attempt ${attempt}/${this.maxRetries}) for text: ${truncatedText.substring(0, 50)}...`);

            this.logger.log('HF_API_TOKEN:', process.env.HF_API_TOKEN);
            // Phương pháp 1: Sử dụng Hugging Face SDK
            if (this.hf && process.env.HF_API_TOKEN) {
                try {
                    const response = await this.generateWithHuggingFace(truncatedText);
                    if (this.isValidEmbedding(response)) {
                        this.logger.log('BUOC 1: Successfully generated embedding with Hugging Face API');
                        return response;
                    }
                } catch (hfError) {
                    //this.logger.warn(`Hugging Face API failed on attempt ${attempt}:`, hfError.message);
                    this.logger.error(`Hugging Face API error on attempt 1:`, hfError);
                }
            }

            // // Phương pháp 2: Sử dụng HTTP request trực tiếp (fallback)
            // try {
            //     const response = await this.generateWithDirectRequest(truncatedText);
            //     if (this.isValidEmbedding(response)) {
            //         this.logger.log('BUOC 2: Successfully generated embedding with direct request');
            //         return response;
            //     }
            // } catch (directError) {
            //     this.logger.warn(`Direct request failed on attempt ${attempt}:`, directError.message);
            // }

            // Chờ trước khi thử lại (exponential backoff)
            // if (attempt < this.maxRetries) {
            //     await this.sleep(this.retryDelay * attempt);
            // }

        } catch (error) {
            //this.logger.error(`Embedding generation attempt ${attempt} failed:`, error.message);
            // if (attempt === this.maxRetries) {
            //     break; // Hết số lần thử, chuyển sang fallback
            // }
        }

        // Bước 4: Nếu tất cả phương pháp đều thất bại, sử dụng fallback embedding
        this.logger.warn('All embedding generation methods failed, using fallback');
        return this.createFallbackEmbedding(truncatedText);
    }

    // tạo embedding với Hugging Face SDK
    private async generateWithHuggingFace(text: string): Promise<number[]> {
        const response = await this.hf.featureExtraction({
            model: this.embeddingModel,
            inputs: text,
        });

        // Hugging Face trả về [ [384 số] ], nên cần unwrap
        if (Array.isArray(response)) {
            const vector = Array.isArray(response[0]) ? response[0] : response;

            if (Array.isArray(vector) && vector.length === this.embeddingDimensions) {
                return vector as number[];
            }
        }

        throw new Error('Invalid response format from Hugging Face API');
    }

    //Tạo embedding sử dụng HTTP request trực tiếp đến Hugging Face API
    private async generateWithDirectRequest(text: string): Promise<number[]> {
        if (!process.env.HF_API_TOKEN) {
            throw new Error('HF_API_TOKEN not available');
        }

        const response = await axios.post(
            `https://api-inference.huggingface.co/models/${this.embeddingModel}`,
            { inputs: text },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.HF_API_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                timeout: 10000, // Timeout 10 giây
            }
        );

        // Validate response format
        if (response.data && Array.isArray(response.data)) {
            const vector = Array.isArray(response.data[0]) ? response.data[0] : response.data;

            if (Array.isArray(vector) && vector.length === this.embeddingDimensions) {
                return vector as number[];
            }
        }


        throw new Error('Invalid response format from direct request');
    }

    // Kiểm tra tính hợp lệ của embedding vector
    private isValidEmbedding(embedding: any): boolean {
        return Array.isArray(embedding) &&
            embedding.length === this.embeddingDimensions &&
            embedding.every(val => typeof val === 'number' && !isNaN(val));
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Tạo vector embedding toàn số 0
    private createEmptyEmbedding(): number[] {
        return new Array(this.embeddingDimensions).fill(0);
    }

    // Tạo fallback embedding đơn giản dựa trên hash và tần suất từ
    private createFallbackEmbedding(text: string): number[] {
        try {
            // Bước 1: Tiền xử lý text - tách từ và làm sạch
            const words = text.toLowerCase()
                .replace(/[^\w\s]/g, '') // Xóa dấu câu
                .split(/\s+/) // Tách từ
                .filter(word => word.length > 2) // Chỉ giữ từ dài hơn 2 ký tự

            const embedding = new Array(this.embeddingDimensions).fill(0);

            // Bước 2: Sử dụng multiple hash functions để phân bố tốt hơn
            words.forEach(word => {
                // Hash 1: Hash bình thường
                const hash1 = this.hashString(word) % this.embeddingDimensions;
                // Hash 2: Hash từ đảo ngược
                const hash2 = this.hashString(word.split('').reverse().join('')) % this.embeddingDimensions;
                // Hash 3: Hash từ + độ dài
                const hash3 = this.hashString(word + word.length) % this.embeddingDimensions;

                // Gán trọng số khác nhau cho mỗi hash
                embedding[hash1] += 0.3;
                embedding[hash2] += 0.2;
                embedding[hash3] += 0.1;
            });

            // Bước 3: Thêm randomness dựa trên độ dài và nội dung text
            const textLength = Math.min(text.length, 100);
            for (let i = 0; i < textLength; i += 10) {
                const index = (textLength + i) % this.embeddingDimensions;
                embedding[index] += 0.05;
            }

            // Bước 4: Normalize vector để có độ dài = 1
            return this.normalizeVector(embedding);
        } catch (error) {
            this.logger.error(`Error creating fallback embedding: ${error.message}`);
            // Backup của backup: tạo vector uniform
            const embedding = new Array(this.embeddingDimensions).fill(0.001);
            this.logger.log('BUOC 3: Successfully generated embedding with fallback method');
            return this.normalizeVector(embedding);
        }
    }

    //Hash function đơn giản để chuyển string thành số
    private hashString(str: string): number {
        let hash = 0;
        if (str.length === 0) return hash;

        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char; // hash * 31 + char
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    // Chia mỗi phần tử cho magnitude để có unit vector
    private normalizeVector(vector: number[]): number[] {
        // Tính magnitude (độ dài) của vector
        const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));

        if (magnitude === 0 || !isFinite(magnitude)) {
            // Nếu magnitude = 0 hoặc không hợp lệ, trả về uniform distribution
            const value = 1 / Math.sqrt(this.embeddingDimensions);
            return new Array(this.embeddingDimensions).fill(value);
        }

        // Chia mỗi phần tử cho magnitude để có unit vector
        return vector.map(val => val / magnitude);
    }

    /**
     * Tính độ tương tự cosine giữa 2 vector embedding
     * Cosine similarity = (A·B) / (|A| × |B|)
     * Giá trị từ -1 đến 1, càng gần 1 càng giống nhau
     * @param vec1 - Vector thứ nhất
     * @param vec2 - Vector thứ hai
     * @returns number - Độ tương tự (0-1)
     */
    calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
        try {
            // Validate input
            if (!Array.isArray(vec1) || !Array.isArray(vec2)) {
                return 0;
            }

            if (vec1.length !== vec2.length || vec1.length !== this.embeddingDimensions) {
                return 0;
            }

            let dotProduct = 0;    // Tích vô hướng A·B
            let magnitude1 = 0;    // |A|²
            let magnitude2 = 0;    // |B|²

            // Tính dot product và magnitude squared
            for (let i = 0; i < vec1.length; i++) {
                if (!isFinite(vec1[i]) || !isFinite(vec2[i])) {
                    return 0;
                }
                dotProduct += vec1[i] * vec2[i];
                magnitude1 += vec1[i] * vec1[i];
                magnitude2 += vec2[i] * vec2[i];
            }

            // Tính magnitude (căn bậc 2)
            magnitude1 = Math.sqrt(magnitude1);
            magnitude2 = Math.sqrt(magnitude2);

            // Kiểm tra chia cho 0
            if (magnitude1 === 0 || magnitude2 === 0 || !isFinite(magnitude1) || !isFinite(magnitude2)) {
                return 0;
            }

            // Tính cosine similarity
            const similarity = dotProduct / (magnitude1 * magnitude2);

            // Clamp giá trị về [0,1] và kiểm tra tính hợp lệ
            return isFinite(similarity) ? Math.max(0, Math.min(1, similarity)) : 0;
        } catch (error) {
            this.logger.error(`Error calculating cosine similarity: ${error.message}`);
            return 0;
        }
    }

    getDimensions(): number {
        return this.embeddingDimensions;
    }

    getModelName(): string {
        return this.embeddingModel;
    }


    // //Tạo embedding cho nhiều text cùng lúc (batch processing)
    // async generateEmbeddings(texts: string[]): Promise<number[][]> {
    //     try {
    //         // Xử lý theo batch để tránh quá tải API
    //         const batchSize = 5; // Mỗi batch 5 text
    //         const results: number[][] = [];

    //         // Chia thành các batch nhỏ
    //         for (let i = 0; i < texts.length; i += batchSize) {
    //             const batch = texts.slice(i, i + batchSize);

    //             // Tạo embedding parallel cho các text trong batch
    //             const batchPromises = batch.map(text => this.generateEmbedding(text));
    //             const batchResults = await Promise.allSettled(batchPromises);

    //             // Xử lý kết quả từng text trong batch
    //             batchResults.forEach((result, index) => {
    //                 if (result.status === 'fulfilled') {
    //                     results.push(result.value);
    //                 } else {
    //                     this.logger.error(`Failed to generate embedding for text ${i + index}: ${result.reason}`);
    //                     // Nếu lỗi, sử dụng fallback embedding
    //                     results.push(this.createFallbackEmbedding(batch[index]));
    //                 }
    //             });

    //             // Nghỉ một chút giữa các batch để tránh rate limiting
    //             if (i + batchSize < texts.length) {
    //                 await this.sleep(100);
    //             }
    //         }

    //         return results;
    //     } catch (error) {
    //         this.logger.error(`Error generating multiple embeddings: ${error.message}`);
    //         // Nếu toàn bộ process lỗi, tạo fallback cho tất cả
    //         return texts.map(text => this.createFallbackEmbedding(text));
    //     }
    // }
}