import { Inject, Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { MediaUrlHelper } from 'libs/media-url.helper';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { firstValueFrom, lastValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { HttpService } from '@nestjs/axios';
import { ClientProxy } from '@nestjs/microservices';
import { Word } from 'apps/sign-language/core/schema/word.schema';
import { Video } from 'apps/sign-language/core/schema/sign_language.schema';
import { get } from 'http';
import * as fs from 'fs'
import { SentenceToken } from 'apps/sign-language/core/schema/sentencetoken.schema';
// ==================== PHRASE TRIE ====================
interface TrieNode {
  children: Map<string, TrieNode>;
  payload?: { gross: string; url: string };
}

class PhraseTrie {
  private root: TrieNode = { children: new Map() };
  public size = 0;  // ← đổi thành public, bỏ getter

  build(phrases: Array<{ gross: string; url: string }>): void {
    this.root = { children: new Map() };
    this.size = 0;  // ← đổi _size thành size
    for (const phrase of phrases) {
      this.insert(phrase.gross.toLowerCase().trim(), phrase);
    }
  }

  private insert(key: string, payload: { gross: string; url: string }): void {
    let node = this.root;
    for (const char of key) {
      if (!node.children.has(char)) {
        node.children.set(char, { children: new Map() });
        this.size++;  // ← đổi _size thành size
      }
      node = node.children.get(char)!;
    }
    node.payload = payload;
  }

  longestMatchAt(
    text: string,
    startPos: number,
  ): { payload: { gross: string; url: string }; endPos: number } | null {
    let node = this.root;
    let lastMatch: { payload: { gross: string; url: string }; endPos: number } | null = null;

    for (let i = startPos; i < text.length; i++) {
      const char = text[i].toLowerCase();
      if (!node.children.has(char)) break;
      node = node.children.get(char)!;

      if (node.payload) {
        const charAfter = text[i + 1] ?? '';
        if (charAfter === '' || /[\s,\.!?;:]/.test(charAfter)) {
          lastMatch = { payload: node.payload, endPos: i + 1 };
          // Không break — tiếp tục tìm match dài hơn
        }
      }
    }
    return lastMatch;
  }
  greedyScan(text: string): Array<
    | { type: 'direct'; gross: string; url: string }
    | { type: 'segment'; text: string }
  > {
    const chunks: Array<
      | { type: 'direct'; gross: string; url: string }
      | { type: 'segment'; text: string }
    > = [];
    const normalized = text.trim();
    let pos = 0;
    let buffer = '';

    while (pos < normalized.length) {
      const isWordStart = pos === 0 || /\s/.test(normalized[pos - 1]);

      if (isWordStart) {
        const match = this.longestMatchAt(normalized, pos);
        if (match) {
          if (buffer.trim()) {
            chunks.push({ type: 'segment', text: buffer.trim() });
            buffer = '';
          }
          chunks.push({ type: 'direct', ...match.payload });
          pos = match.endPos;
          while (pos < normalized.length && normalized[pos] === ' ') pos++;
          continue;
        }
      }

      buffer += normalized[pos];
      pos++;
    }

    if (buffer.trim()) {
      chunks.push({ type: 'segment', text: buffer.trim() });
    }
    return chunks;
  }
}

// ==================== PHOBERT CONFIG ====================
const PHOBERT_API_URL = process.env.PHOBERT_API_URL || 'https://veinless-unslanderously-jordyn.ngrok-free.dev'; // ⚠️ Thay bằng URL từ PhoBERT server
const PHOBERT_HEALTH_CHECK = `${PHOBERT_API_URL}/health`;
const PHOBERT_PREDICT_URL = `${PHOBERT_API_URL}/predict`;



@Injectable()
export class SignLanguageService {
  private readonly logger = new Logger(SignLanguageService.name);
  private SYNONISM_URL = process.env.SYNNONISM_URL;
  private PHOWHISPER_URL = process.env.PHOWHISPER_URL;
  private DETECT_URL = process.env.DETECT_URL;
  private readonly trie = new PhraseTrie();
  private trieLastModified = 0;

  //lấy data.json ở root thư mục (cùng cấp với node_modules, apps, libs, v.v.) để build trie in-memory
  private readonly DATA_JSON_PATH = process.cwd() + '/data.json';
  constructor(
    private readonly httpService: HttpService,
    @InjectModel(Word.name, "signLanguageConnection") private wordModel: Model<Word>,
    @InjectModel(Video.name, "signLanguageConnection") private videoModel: Model<Video>,
    @Inject("PHOWHISPER_CLIENT") private phowhisperClient: ClientProxy,
    @Inject("UNDERTHESEA_CLIENT") private undertheseaClient: ClientProxy,
    @Inject('MEDIA_CLIENT') private mediaClient: ClientProxy,
    private readonly mediaUrlHelper: MediaUrlHelper,
  ) { }
  // Thêm onModuleInit — NestJS tự gọi khi service khởi động
  async onModuleInit(): Promise<void> {
    await this.buildTrie();
    // Tự rebuild nếu data.json thay đổi, kiểm tra mỗi 5 phút
    setInterval(() => this.checkAndRebuildTrie(), 5 * 60 * 1000);
  }

  
  async best_match_sentence(tokens: SentenceToken[]): Promise<string[]> {
    const resolved: string[] = [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      // Là string thường → giữ nguyên
      if (typeof token === 'string') {
        resolved.push(token);
        continue;
      }

      // Là mảng candidates → nhờ PhoBERT chọn best match
      const context_before = [...resolved]; // những từ đã resolve trước đó

      // context_after: lấy các string đơn phía sau (bỏ qua các mảng chưa resolve)
      const context_after: string[] = [];
      for (let j = i + 1; j < tokens.length; j++) {
        if (typeof tokens[j] === 'string') {
          context_after.push(tokens[j] as string);
        }
      }

      try {
        const response = await firstValueFrom(
          this.httpService.post(`${PHOBERT_API_URL}/select-best`, {
            context_before,
            context_after,
            candidates: token, // chính là mảng string[] tại vị trí này
          })
        );
        resolved.push(response.data.best);
      } catch (error) {
        this.logger.warn(`Best match failed at index ${i}, fallback to: "${token[0]}"`);
        resolved.push(token[0]); // fallback: lấy candidate đầu tiên
      }
    }

    return resolved;
  }

  // ── 2. COMPLETE SENTENCE ─────────────────────────────────────────────────────
  // Input : ['Anh', 'không', 'yêu', 'em', 'nhiều', 'ngày xưa']
  // Output: ['Anh', 'không', 'yêu', 'em', 'nhiều', 'như', 'ngày xưa']
  async complete_sentence(tokens: string[]): Promise<string[]> {
    let bestSentence = [...tokens];
    let bestScore = -Infinity;

    // Thử chèn từ vào từng vị trí: trước tok[0], giữa tok[i] và tok[i+1], sau tok[n-1]
    for (let insertPos = 0; insertPos <= tokens.length; insertPos++) {
      const before = tokens.slice(0, insertPos);
      const after  = tokens.slice(insertPos);

      try {
        // Hỏi PhoBERT: từ gì nên đứng sau `before`?
        const completeRes = await firstValueFrom(
          this.httpService.post(`${PHOBERT_API_URL}/complete`, {
            tokens: before.length > 0 ? before : [''],
            top_k: 3,
          })
        );

        const suggestions: Array<{ word: string; score: number }> =
          completeRes.data.suggestions || [];

        // Với mỗi từ gợi ý, tạo câu đầy đủ và score
        for (const suggestion of suggestions) {
          const candidate = [...before, suggestion.word, ...after];

          const scoreRes = await firstValueFrom(
            this.httpService.post(`${PHOBERT_API_URL}/score`, {
              tokens: candidate,
            })
          );

          const sentenceScore: number = scoreRes.data.score ?? -Infinity;

          if (sentenceScore > bestScore) {
            bestScore    = sentenceScore;
            bestSentence = candidate;
          }
        }
      } catch (error) {
        // Bỏ qua vị trí này nếu lỗi, tiếp tục vị trí khác
        this.logger.warn(`complete_sentence: skip position ${insertPos}: ${error.message}`);
      }
    }

    return bestSentence;
  }

  // ── 3. REORDER (sửa return type) ─────────────────────────────────────────────
  async reorder_tokens(tokens: string[]): Promise<string[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${PHOBERT_API_URL}/reorder`, {
          tokens,
          fixed_first: true,
        })
      );
      return response.data.best_order as string[];
    } catch (error) {
      if (error instanceof AxiosError) {
        this.logger.error(`PhoBERT API error: ${error.message}`);
        throw new HttpException(`PhoBERT API error: ${error.message}`, HttpStatus.BAD_GATEWAY);
      }
      throw new HttpException(`Unexpected error: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ── 4. ORCHESTRATION: best_match → reorder → complete ────────────────────────
  // Input : ['tôi', 'yêu', ['cam', 'bạn', 'đau đớn'], 'nhiều', 'lắm']
  // Step 1: best_match  → ['tôi', 'yêu', 'bạn', 'nhiều', 'lắm']
  // Step 2: reorder     → ['tôi', 'yêu', 'bạn', 'nhiều', 'lắm']   (nếu đã đúng thứ tự)
  // Step 3: complete    → ['tôi', 'yêu', 'bạn', 'nhiều', 'lắm', 'thật']
  async process_sentence(tokens: SentenceToken[]): Promise<{
    after_best_match: string[];
    after_reorder:    string[];
    after_complete:   string[];
    final_sentence:   string;
  }> {
    this.logger.log(`[process_sentence] Start: ${JSON.stringify(tokens)}`);

    // Step 1: Chọn best match cho các vị trí có nhiều candidates
    const afterBestMatch = await this.best_match_sentence(tokens);
    this.logger.log(`[process_sentence] After best_match: ${afterBestMatch.join(' ')}`);

    // Step 2: Sắp xếp lại thứ tự từ cho tự nhiên
    const afterReorder = await this.reorder_tokens(afterBestMatch);
    this.logger.log(`[process_sentence] After reorder: ${afterReorder.join(' ')}`);

    // Step 3: Bổ sung từ còn thiếu cho câu tròn trịa
    const afterComplete = await this.complete_sentence(afterReorder);
    this.logger.log(`[process_sentence] After complete: ${afterComplete.join(' ')}`);

    return {
      after_best_match: afterBestMatch,
      after_reorder:    afterReorder,
      after_complete:   afterComplete,
      final_sentence:   afterComplete.join(' '),
    };
  }
  private async checkAndRebuildTrie(): Promise<void> {
    try {
      const stat = await fs.promises.stat(this.DATA_JSON_PATH);
      if (stat.mtimeMs > this.trieLastModified) {
        this.logger.log('data.json changed — rebuilding trie...');
        await this.buildTrie();
      }
    } catch (err) {
      this.logger.warn(`Cannot stat data.json: ${err.message}`);
    }
  }

  private async buildTrie(): Promise<void> {
    try {
      const t0 = Date.now();
      const raw = await fs.promises.readFile(this.DATA_JSON_PATH, 'utf-8');
      const phrases: Array<{ gross: string; url: string }> = JSON.parse(raw);
      this.trie.build(phrases);
      this.trieLastModified = Date.now();
      this.logger.log(
        `✅ Trie built in ${Date.now() - t0}ms — ${phrases.length} phrases, ${this.trie.size} nodes`,
      );
    } catch (err) {
      this.logger.warn(`⚠️ Could not build trie from data.json: ${err.message}`);
    }
  }


  private parseSRTContent(srtContent: string): string {
    const lines = srtContent.split('\n');
    const textLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (!line ||
        /^\d+$/.test(line) ||
        /^\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}$/.test(line)) {
        continue;
      }

      textLines.push(line);
    }

    return textLines.join(' ').trim();
  }

  async getGestureCode(videoUrl: string) {
    this.logger.log(`Processing gesture code for: "${videoUrl}"`);
    const startTime = Date.now();

    // 1. Kiểm tra cache
    const cachedVideo = await this.videoModel.findOne({ videoUrl });
    if (cachedVideo?.wordCodes) {
        this.logger.log('Cache hit, returning stored gesture codes');
        try {
            return JSON.parse(cachedVideo.wordCodes);
        } catch {
            this.logger.warn('Cache parse failed, reprocessing...');
        }
    }

    try {
        // STEP 1: Subtitle (bỏ comment khi subtitle service sẵn sàng)
        // const subtitleRes = await firstValueFrom(
        //     this.phowhisperClient.send('subtitle.getSubtitle', { videoUrl })
        // );
        // const srtResponse = await firstValueFrom(
        //     this.httpService.get(subtitleRes.subtitleUrl, { responseType: 'text' })
        // );
        // const subtitleText = this.parseSRTContent(srtResponse.data);
        // if (!subtitleText) throw new Error('Subtitle extraction failed');

        const subtitleText = 'Hôm nay'; // TODO: xóa khi bỏ comment trên

        // STEP 2: Tokenize
        this.logger.log('Step 2: Tokenizing...');
        const postagRes = await firstValueFrom(
            this.undertheseaClient.send('underthesea.pos', { text: subtitleText })
        );
        if (!postagRes?.success || !Array.isArray(postagRes?.pos_tags)) {
            throw new Error('POSTag failed');
        }
        const validPosTags = ['N','Np','Nc','Nu','Ny','Nb','V','Vb','Vy','L','E','A','R','M','P','FW','B'];
        const tokens: string[] = postagRes.pos_tags
            .filter(([_, tag]) => validPosTags.includes(tag))
            .map(([word]) => word.trim());
        this.logger.log(`Tokens: ${tokens.join(', ')}`);

        // STEP 3: Synonym lookup
        this.logger.log(`Step 3: Synonym lookup for ${tokens.length} tokens...`);
        const synonymMap = new Map<string, any[]>();
        try {
            const synonymRes = await firstValueFrom(
                this.httpService.post(
                    `${this.SYNONISM_URL}/search`,
                    { queries: tokens },
                    { timeout: 30_000 }
                )
            );
            const results = synonymRes.data?.results;
            if (results && typeof results === 'object') {
                Object.entries(results).forEach(([token, data]: [string, any]) => {
                    synonymMap.set(token, data.found && data.url
                        ? [{ gross: data.synonym, url: data.url, accuracy: data.accuracy }]
                        : []
                    );
                    this.logger.debug(data.found
                        ? `✅ "${token}" → "${data.synonym}" (${data.accuracy}%)`
                        : `❌ No synonym: "${token}"`
                    );
                });
            }
        } catch (e) {
            this.logger.error(`Synonym lookup failed: ${e.message}`);
        }
        tokens.forEach(t => { if (!synonymMap.has(t)) synonymMap.set(t, []); });

        const found = [...synonymMap.values()].filter(v => v.length > 0).length;
        this.logger.log(`Synonym map: ${found}/${tokens.length} found`);

        // STEP 4: Process từng token
        this.logger.log('Step 4: Processing tokens...');
        const allGestureCodes: any[] = [];

        for (const token of tokens) {
            this.logger.log(`\n=== Processing "${token}" ===`);
            try {
                // Kiểm tra cache word
                const existingWord = await this.wordModel.findOne({ word: token });
                if (existingWord?.code) {
                    try {
                        const cached = JSON.parse(existingWord.code);
                        allGestureCodes.push({
                            word: token,
                            gestureData: cached,
                            cached: true,
                            accuracy: existingWord.accuracy,
                            gross: existingWord.gross
                        });
                        existingWord.usageCount += 1;
                        await existingWord.save();
                        this.logger.log(`✅ Cache hit: "${token}"`);
                        continue;
                    } catch {
                        this.logger.warn(`Cache parse failed for "${token}", reprocessing...`);
                    }
                }

                const synonymArray = synonymMap.get(token) || [];
                if (synonymArray.length === 0) {
                    this.logger.warn(`⚠️ Skip "${token}" - no synonym`);
                    continue;
                }

                // Gọi Colab với timeout 2 phút
                const wordData = await Promise.race([
                    this.processSingleWord(token, synonymArray),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error(`Timeout: "${token}"`)), 120_000)
                    )
                ]) as any;

                if (!wordData?.gestureData) {
                    this.logger.warn(`⚠️ No gesture data for "${token}"`);
                    continue;
                }

                // Lưu cục bộ vào Word collection — stringify gestureData thay vì upload
                await new this.wordModel({
                    word: token,
                    code: JSON.stringify(wordData.gestureData), // ← lưu thẳng JSON
                    originalVideoUrl: wordData.originalVideoUrl,
                    accuracy: wordData.accuracy,
                    gross: wordData.gross,
                    tags: ['auto-generated'],
                    usageCount: 1
                }).save();

                allGestureCodes.push({
                    word: token,
                    gestureData: wordData.gestureData,
                    cached: false,
                    accuracy: wordData.accuracy,
                    gross: wordData.gross
                });
                this.logger.log(`✅ Done: "${token}"`);

            } catch (e) {
                this.logger.error(`❌ Skip "${token}": ${e.message}`);
            }
        }

        // STEP 5: Lưu vào Video collection — stringify toàn bộ result
        const processingTime = Date.now() - startTime;
        const gestureCodesJson = JSON.stringify(allGestureCodes);

        await this.videoModel.findOneAndUpdate(
            { videoUrl },
            {
                videoUrl,
                wordCodes: gestureCodesJson, // ← lưu thẳng JSON, không upload
                processedWords: tokens,
                subtitleText,
                totalProcessingTime: processingTime
            },
            { upsert: true, new: true }
        );

        this.logger.log(`✅ Done in ${processingTime}ms | ${allGestureCodes.length}/${tokens.length} tokens processed`);

        // Return trực tiếp — không đệ quy, không gọi lại getGestureCode
        return allGestureCodes;

    } catch (error) {
        this.handleError(error);
    }
  }
  async getSignLanguageVideoPlaylist(text: string): Promise<Array<{ gross: string; url: string }>> {
    this.logger.log(`Processing text for sign language video playlist: "${text}"`);
    const startTime = Date.now();

    try {
      // --- BƯỚC 0 (MỚI): Greedy match cụm dài nhất từ Trie in-memory ---
      // Không đọc file, không sort array — chỉ O(L) với L = độ dài text
      this.logger.log('Step 0: Greedy matching phrases from trie...');
      const chunks = this.trie.greedyScan(text);

      this.logger.debug(
        `Chunks: ${chunks.map(c =>
          c.type === 'direct' ? `[DIRECT: "${c.gross}"]` : `[SEG: "${c.text}"]`
        ).join(' | ')}`,
      );

      const videoPlaylist: Array<{ gross: string; url: string }> = [];

      for (const chunk of chunks) {
        if (chunk.type === 'direct') {
          // Khớp cụm trong data.json → dùng ngay, bỏ qua tokenize + lookup
          videoPlaylist.push({ gross: chunk.gross, url: chunk.url });
        } else {
          // Phần còn lại → pipeline tokenize + lookup như cũ
          const segmentVideos = await this.processSegment(chunk.text);
          videoPlaylist.push(...segmentVideos);
        }
      }

      const processingTime = Date.now() - startTime;
      this.logger.log(`✅ Playlist created in ${processingTime}ms. Total: ${videoPlaylist.length} videos`);

      return videoPlaylist;

    } catch (error) {
      this.logger.error(`Failed to generate video playlist: ${error.message}`);
      throw error;
    }
  }

  private async processSegment(text: string): Promise<Array<{ gross: string; url: string }>> {
    // --- BƯỚC 2: Tokenize (Underthesea) ---
    const postagRes = await firstValueFrom(
      this.undertheseaClient.send('underthesea.pos', { text })
    );

    if (!postagRes?.success || !Array.isArray(postagRes?.pos_tags)) {
      this.logger.warn(`POSTag failed for segment: "${text}"`);
      return [];
    }

    const validPosTags = ['N', 'Np', 'Nc', 'Nu', 'Ny', 'Nb', 'V', 'Vb', 'Vy', 'L', 'E', 'A', 'M', 'P', 'FW', 'B'];

    // ✅ Tách tên riêng (Np) thành từng ký tự trước khi flatten thành tokens
    const tokens: string[] = postagRes.pos_tags
      .filter(([, tag]: [string, string]) => validPosTags.includes(tag))
      .flatMap(([word, tag]: [string, string]) => {
        if (tag === 'Np') {
          // Tên riêng → tách từng chữ cái, uppercase, bỏ khoảng trắng
          // VD: "Khoa" → ["K", "H", "O", "A"]
          // VD: "Nguyễn Văn An" → ["N","G","U","Y","Ê","N","V","Ă","N","A","N"]
          const chars = word
            .replace(/\s+/g, '')      // bỏ khoảng trắng giữa các từ ghép
            .toLowerCase()
            .split('');
          this.logger.debug(`🔤 Proper noun "${word}" → [${chars.join(', ')}]`);
          return chars;
        }
        return [word.trim()];
      });

    if (tokens.length === 0) return [];

    console.log(`Tokens for segment "${text}": ${tokens.join(', ')} with tags ${postagRes.pos_tags.map(([w, t]) => `${w}/${t}`).join(', ')}`);

    // --- BƯỚC 3: Lookup video URL theo batch ---
    const synonymEndpoint = `${this.SYNONISM_URL}/search`;
    const synonymMap = new Map<string, { gross: string; url: string }>();

    // ⚠️ tokens có thể trùng ký tự (VD: "AN" có 2 chữ A)
    // Dùng index để giữ đúng thứ tự thay vì Map theo key
    const uniqueQueries = [...new Set(tokens)];
    const MAX_BATCH_SIZE = 100;

    for (let i = 0; i < uniqueQueries.length; i += MAX_BATCH_SIZE) {
      const batch = uniqueQueries.slice(i, i + MAX_BATCH_SIZE);
      const batchIndex = Math.floor(i / MAX_BATCH_SIZE);

      try {
        const synonymRes = await firstValueFrom(
          this.httpService.post(synonymEndpoint, { queries: batch }, { timeout: 30000 })
        );

        const results = synonymRes.data?.results;
        if (results && typeof results === 'object') {
          Object.entries(results).forEach(([token, data]: [string, any]) => {
            if (data.found && data.url) {
              synonymMap.set(token, { gross: data.synonym, url: data.url });
              this.logger.debug(`✅ Mapped: "${token}" → "${data.synonym}"`);
            } else {
              this.logger.debug(`❌ No video for "${token}", skipping.`);
            }
          });
        }

        if (i + MAX_BATCH_SIZE < uniqueQueries.length) {
          await new Promise(r => setTimeout(r, 500));
        }
      } catch (error) {
        this.logger.error(`❌ Batch ${batchIndex + 1} error: ${error.message}`);
      }
    }

    // --- BƯỚC 4: Ghép theo đúng thứ tự tokens (giữ duplicate) ---
    const skipped: string[] = [];
    const result = tokens.flatMap(token => {
      if (synonymMap.has(token)) return [synonymMap.get(token)!];
      skipped.push(token);
      return [];
    });

    if (skipped.length > 0) {
      this.logger.debug(`Skipped tokens in segment: ${skipped.join(', ')}`);
    }

    return result;
  }

  private async processSingleWord(word: string, synonymData: any[]): Promise<any> {
    if (!synonymData || !Array.isArray(synonymData) || synonymData.length === 0) {
      throw new Error(`No synonym data found for word: ${word}`);
    }

    // Sort by accuracy and select best match
    const sortedSynonyms = [...synonymData].sort((a, b) => {
      const accA = parseFloat(a.accuracy) || 0;
      const accB = parseFloat(b.accuracy) || 0;
      return accB - accA;
    });

    const bestMatch = sortedSynonyms[0];
    const videoUrl = bestMatch.url;
    const accuracy = bestMatch.accuracy;
    const gross = bestMatch.gross;

    this.logger.log(`Processing word: "${word}"`);
    this.logger.log(`  ✅ Selected best match: "${gross}" (Accuracy: ${accuracy}%)`);
    this.logger.log(`  📹 Video URL: ${videoUrl}`);

    try {
      const colabApiUrl = this.DETECT_URL;
      const jobResponse = await firstValueFrom(
        this.httpService.post(
          `${colabApiUrl}/api/detect`,
          {
            video_url: videoUrl,
            frames_per_minute: 0.1
          },
          { timeout: 300000 }
        )
      );

      const jobId = jobResponse.data.job_id;
      this.logger.log(`Job created: ${jobId} for word: ${word}`);

      const gestureData = await this.pollForJobCompletion(colabApiUrl, jobId, word);

      if (!gestureData) {
        throw new Error(`Failed to get gesture data for word: ${word}`);
      }

      // Upload individual gesture data
      const mediaUrl = await this.uploadGestureToMedia(word, gestureData);

      return {
        word: word,
        code: mediaUrl, // URL to individual gesture
        originalVideoUrl: videoUrl,
        accuracy: accuracy,
        gross: gross,
        gestureData: gestureData
      };

    } catch (error) {
      this.logger.error(`Error processing word "${word}": ${error.message}`);
      throw error;
    }
  }

  private async pollForJobCompletion(colabApiUrl: string, jobId: string, word: string): Promise<any> {
    let attempts = 0;
    const maxAttempts = 100000;

    while (attempts < maxAttempts) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 5000));

      try {
        const statusResponse = await firstValueFrom(
          this.httpService.get(`${colabApiUrl}/api/job/${jobId}`)
        );

        const jobStatus = statusResponse.data;

        if (jobStatus.status === 'completed') {
          this.logger.log(`Job ${jobId} completed for word: ${word}`);

          const downloadResponse = await firstValueFrom(
            this.httpService.get(`${colabApiUrl}/api/job/${jobId}/download`, {
              responseType: 'json'
            })
          );

          return downloadResponse.data;

        } else if (jobStatus.status === 'failed') {
          throw new Error(`Job failed: ${jobStatus.message}`);
        }
      } catch (error) {
        if (attempts >= maxAttempts) {
          throw new Error('Timeout waiting for job completion');
        }
      }
    }

    throw new Error('Max polling attempts reached');
  }

  private async uploadGestureToMedia(word: string, gestureData: any): Promise<string> {
    try {
      const jsonString = JSON.stringify(gestureData, null, 2);

      const uploadResponse = await lastValueFrom(
        this.mediaClient.send(
          'media.upload-json',
          {
            jsonData: jsonString,
            publicId: `gesture_${word}_${Date.now()}`,
            folder: 'sign-language/gestures',
            tags: ['sign-language', 'gesture', word],
            resource_type: 'raw'
          }
        )
      );

      return (uploadResponse as any).relative_path;

    } catch (error) {
      this.logger.error(`Error uploading to Media for word "${word}": ${error.message}`);
      throw error;
    }
  }

  // ✅ NEW: Upload combined gesture codes for entire video
  private async uploadCombinedGestureCodes(videoUrl: string, gestureCodes: any[]): Promise<string> {
    try {
      const videoId = Buffer.from(videoUrl).toString('base64').substring(0, 20);
      const jsonString = JSON.stringify(gestureCodes, null, 2);

      const uploadResponse = await lastValueFrom(
        this.mediaClient.send(
          'media.upload-json',
          {
            jsonData: jsonString,
            publicId: `video_gestures_${videoId}_${Date.now()}`,
            folder: 'sign-language/videos',
            tags: ['sign-language', 'video-gestures', 'combined'],
            resource_type: 'raw'
          }
        )
      );

      return (uploadResponse as any).relative_path;

    } catch (error) {
      this.logger.error(`Error uploading combined gesture codes: ${error.message}`);
      throw error;
    }
  }

  async getWordByWord(word: string) {
    const wordResult = await this.wordModel.findOne({ word });
    return this.mediaUrlHelper.constructObjectUrls(wordResult?.toObject(), ['code']);
  }

  async getVideoByUrl(videoUrl: string) {
    const video = await this.videoModel.findOne({ videoUrl });
    const videoWithUrls = this.mediaUrlHelper.constructObjectUrls(video?.toObject(), ['wordCodes']);
    return videoWithUrls;
  }

  async getAllWords(skip = 0, limit = 50) {
    return await this.wordModel.find()
      .sort({ usageCount: -1, word: 1 })
      .skip(skip)
      .limit(limit);
  }

  async getAllVideos(skip = 0, limit = 20) {
    return await this.videoModel.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  }

  async updateWordCode(word: string, newCode: string) {
    return await this.wordModel.findOneAndUpdate(
      { word },
      { code: newCode, $inc: { usageCount: 1 } },
      { new: true }
    );
  }

  async searchWords(query: string) {
    return await this.wordModel.find({
      word: { $regex: query, $options: 'i' }
    }).limit(20);
  }

  private handleError(error: any) {
    if (error instanceof AxiosError) {
      this.logger.error(`External API Error: ${error.message}`);
      this.logger.error('Response data:', error.response?.data);
      this.logger.error('Request url:', error.config?.url);

      throw new HttpException(
        error.response?.data?.error || error.response?.data || 'Lỗi từ phía AI Server',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    this.logger.error('Internal Server Error', error);
    throw new HttpException(error.message || 'Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
  }

  async getGestureWordCode(videoUrl: string) {
    const video = await this.videoModel.findOne({ videoUrl: videoUrl });
    if (video && video.wordCodes) {
      console.log("Da co video trong db, tra ve wordCodes");
      console.log("Ket qua tra ve", this.mediaUrlHelper.constructObjectUrls(video.toObject(), ['wordCodes']));
      return this.mediaUrlHelper.constructObjectUrls(video.toObject(), ['wordCodes']);
    }
    console.log("Chua co video trong db, goi getGestureCode với videoUrl: ", videoUrl)
    return this.getGestureCode(videoUrl);
  }
}