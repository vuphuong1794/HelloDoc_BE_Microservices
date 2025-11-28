import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class QdrantService implements OnModuleInit {
    private readonly logger = new Logger(QdrantService.name);
    private client: QdrantClient;
    private readonly collectionName = 'postEmbedding';
    private readonly vectorSize = 1024; // BAAI/bge-m3 model produces 1024-dimensional embeddings

    // trạng thái để tránh tạo nhiều lần khi concurrent
    private collectionReady = false;
    private ensurePromise?: Promise<void>;

    constructor() {
        this.client = new QdrantClient({
            url: process.env.QDRANT_URL,       // ex: "http://localhost:6333" hoặc Qdrant Cloud URL
            apiKey: process.env.QDRANT_API_KEY // nếu dùng Cloud
        });
    }

    async onModuleInit() {
        try {
            await this.ensureCollection(); // đảm bảo collection tồn tại ngay khi service khởi động
        } catch (err) {
            this.logger.error('Failed to ensure Qdrant collection on init', err);
        }
    }
    async initCollection() {
        try {
            await this.client.createCollection(
                this.collectionName,
                {
                    vectors:
                    {
                        size: this.vectorSize, // phải khớp với dimension của model embedding bạn đang dùng 
                        distance: 'Cosine' // Cosine phổ biến cho semantic search 
                    }
                }
            );
            this.logger.log('Qdrant collection "postEmbedding" initialized');
        } catch (err: any) {
            if (err.status === 409) {
                this.logger.log('Collection "postEmbedding" đã tồn tại, skip.');
            }
            else {
                this.logger.error('Error creating collection', err);
            }
        }
    }

    // idempotent + concurrent-safe
    private async ensureCollection(): Promise<void> {
        if (this.collectionReady) return;
        if (this.ensurePromise) return this.ensurePromise;

        this.ensurePromise = (async () => {
            try {
                await this.client.getCollection(this.collectionName);
                this.logger.log(`Collection "${this.collectionName}" already exists`);
            } catch (err: any) {
                // Nếu không tồn tại -> tạo mới
                // Qdrant có thể trả 404 hoặc lỗi khác khi collection chưa có
                this.logger.log(`Collection "${this.collectionName}" not found, creating...`);
                await this.client.createCollection(this.collectionName, {
                    vectors: {
                        size: this.vectorSize,
                        distance: 'Cosine',
                    },
                });
                this.logger.log(`Created collection "${this.collectionName}" with size=${this.vectorSize}`);
            } finally {
                this.collectionReady = true;
                this.ensurePromise = undefined;
            }
        })();

        return this.ensurePromise;
    }




    // normalize vector: flatten single-nested arrays, convert to number[], validate length and values
    private normalizeVector(vec: any): number[] {
        if (!Array.isArray(vec)) throw new Error('Embedding is not an array');

        // nếu trường hợp embedding là [[...]] (1-element wrapper), unwrap
        if (vec.length === 1 && Array.isArray(vec[0])) {
            vec = vec[0];
        }

        const arr = vec.map((v: any) => {
            const n = Number(v);
            if (Number.isNaN(n) || !isFinite(n)) {
                throw new Error('Embedding contains NaN or infinite');
            }
            return n;
        });

        if (arr.length !== this.vectorSize) {
            throw new Error(`Embedding dimension mismatch: got ${arr.length}, expected ${this.vectorSize}`);
        }

        return arr;
    }

    // sanitize payload: convert ObjectId/Date -> string, remove undefined, recursively
    private sanitizePayload(input: any): any {
        if (input === null || input === undefined) return null;
        if (typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean') return input;
        if (input instanceof Date) return input.toISOString();
        if (Array.isArray(input)) return input.map((v) => this.sanitizePayload(v));

        if (typeof input === 'object') {
            // convert common Mongo ObjectId (has toHexString) or Mongoose ObjectId
            if (typeof input.toHexString === 'function') return input.toHexString();
            if (input && input.constructor && /ObjectId/i.test(input.constructor.name)) {
                try { return input.toString(); } catch { }
            }

            const out: Record<string, any> = {};
            for (const [k, v] of Object.entries(input)) {
                const val = this.sanitizePayload(v);
                if (val !== undefined) out[k] = val;
            }
            return out;
        }

        // fallback
        return String(input);
    }

    async upsertPost(postId: string, vector: any, payload: any) {
        await this.ensureCollection();

        // Nếu postId là ObjectId => convert sang UUID v4
        let safeId: string;
        if (/^[a-fA-F0-9]{24}$/.test(postId)) {
            // Map ObjectId -> UUID ổn định (ví dụ hash)
            const uuid = uuidv4(); // hoặc tạo mapping ổn định từ ObjectId -> UUID
            safeId = uuid;
        } else {
            safeId = postId;
        }

        const vec = this.normalizeVector(vector);
        const safePayload = this.sanitizePayload(payload);

        return await this.client.upsert(this.collectionName, {
            points: [
                {
                    id: safeId,
                    vector: vec,
                    payload: {
                        ...safePayload,
                        postId: postId, // giữ nguyên postId gốc trong payload để truy xuất sau
                    },
                },
            ],
        });
    }


    // async upsertPost(postId: string, vector: any, payload: any) {
    //     await this.ensureCollection();

    //     // Nếu postId là ObjectId => convert sang UUID v4
    //     let safeId: string;
    //     if (/^[a-fA-F0-9]{24}$/.test(postId)) {
    //         // Map ObjectId -> UUID ổn định (ví dụ hash)
    //         const uuid = uuidv4(); // hoặc tạo mapping ổn định từ ObjectId -> UUID
    //         safeId = uuid;
    //     } else {
    //         safeId = postId;
    //     }

    //     const vec = this.normalizeVector(vector);
    //     const safePayload = this.sanitizePayload(payload);
    //     //upsert la pdate + insert
    //     return await this.client.upsert(this.collectionName, {
    //         points: [
    //             {
    //                 id: safeId,   // 👈 giờ là UUID hợp lệ
    //                 vector: vec,
    //                 payload: safePayload,
    //             },
    //         ],
    //     });
    // }

    async findSimilarPostsQdrant(
        queryVector: number[],
        limit = 5,
        minSimilarity = 0.5,
    ) {
        //await this.ensureCollection(); // optional: đảm bảo collection đã sẵn sàng
        const results = await this.client.search(this.collectionName, {
            vector: this.normalizeVector(queryVector),
            limit: limit,
            score_threshold: minSimilarity
        });

        this.logger.log(`QdrantService: Found ${results.length} similar posts`);
        this.logger.debug(`QdrantService raw results: ${JSON.stringify(results, null, 2)}`);

        return results.map((r) => ({
            postId: r.payload?.postId,
            similarity: r.score,
        }));
    }

    async deleteAll() {
        console.log("Deleting all data from Qdrant collection...");
        await this.client.deleteCollection(this.collectionName);
        await this.client.createCollection(this.collectionName, {
            vectors: { size: this.vectorSize, distance: 'Cosine' }
        });
        this.collectionReady = false;
        await this.ensureCollection();
        return { message: 'All data deleted from Qdrant collection.' };
    }

    async deleteById(postId: string) {
        const safeId = String(postId);
        await this.client.delete(this.collectionName, {
            points: [safeId],
        });
        return { message: `Post with ID ${postId} deleted from Qdrant.` };
    }
    
}
