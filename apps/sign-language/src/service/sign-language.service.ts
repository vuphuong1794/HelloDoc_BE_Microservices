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
    this.logger.log(`Processing gesture code for video URL: ${videoUrl}`);
    const startTime = Date.now();

    // 1. Kiểm tra cache trong Video collection
    const cachedVideo = await this.videoModel.findOne({ videoUrl });

    if (cachedVideo && cachedVideo.wordCodes) {
      this.logger.log("Found cached data for video");

      // Fetch gesture codes from URL
      try {
        const gestureResponse = await firstValueFrom(
          this.httpService.get(cachedVideo.wordCodes)
        );

        return gestureResponse.data
      } catch (error) {
        this.logger.warn(`Failed to fetch cached gesture codes: ${error.message}`);
        // Continue to reprocess if cache fetch fails
      }
    }

    try {
      // --- STEP 1: Get Subtitle ---
      this.logger.log(`Step 1: Fetching subtitle from phowhisper`);
      this.logger.log(`Checking videoUrl before sending: ${videoUrl}`); // <-- Thêm dòng này
      const subtitleRes = await firstValueFrom(
        this.phowhisperClient.send(
          "subtitle.getSubtitle",
          { videoUrl }
        )
      );

      if (!subtitleRes?.subtitleUrl) {
        throw new Error("No subtitle URL returned from phowhisper");
      }

      const srtResponse = await firstValueFrom(
        this.httpService.get(subtitleRes.subtitleUrl, {
          responseType: 'text'
        })
      );

      const srtContent = srtResponse.data;
      const subtitleText = this.parseSRTContent(srtContent);

      if (!subtitleText) throw new Error("Subtitle extraction failed - no text found");
      this.logger.debug(`Subtitle text extracted: ${subtitleText}`);

      // --- STEP 2: Tokenize (Underthesea) ---
      this.logger.log(`Step 2: Tokenizing text...`);
      const postagRes = await firstValueFrom(
        this.undertheseaClient.send('underthesea.pos', { text: subtitleText })
      );

      if (!postagRes?.success || !Array.isArray(postagRes?.pos_tags)) {
        throw new Error("POSTag failed or returned invalid response");
      }

      const validPosTags = ['N', 'Np', 'Nc', 'Nu', 'Ny', 'Nb', 'V', 'Vb', 'Vy', 'L', 'E', 'A', 'M', 'P', 'FW', 'B'];
      const tokens = postagRes.pos_tags
        .filter(([word, tag]) => validPosTags.includes(tag))
        .map(([word, tag]) => word.trim());

      this.logger.debug(`Tokens: ${tokens.join(', ')}`);

      // --- STEP 3: Get Synonyms ---
      const synonymEndpoint = `${this.SYNONISM_URL}/search`;
      this.logger.log(`Step 3: Getting synonyms for ${tokens.length} words...`);

      const synonymMap: Map<string, any[]> = new Map();

      // Kiểm tra nếu có quá nhiều tokens, chia batch
      const MAX_BATCH_SIZE = 100;  // Giới hạn để tránh timeout
      const batches: string[][] = [];

      for (let i = 0; i < tokens.length; i += MAX_BATCH_SIZE) {
        batches.push(tokens.slice(i, i + MAX_BATCH_SIZE));
      }

      this.logger.log(`Processing ${batches.length} batch(es)...`);

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];

        try {
          this.logger.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} tokens)...`);

          const synonymRes = await firstValueFrom(
            this.httpService.post(
              synonymEndpoint,
              { queries: batch },  // ✅ Gửi array
              { timeout: 30000 }   // 30s timeout
            )
          );

          const results = synonymRes.data?.results;

          if (results && typeof results === 'object') {
            let foundCount = 0;
            let notFoundCount = 0;

            Object.entries(results).forEach(([token, data]: [string, any]) => {
              if (data.found && data.url) {  // ✅ Giờ chỉ có 1 URL
                synonymMap.set(token, [{
                  gross: data.synonym,
                  url: data.url,  // ✅ Không phải data.urls[0] nữa
                  accuracy: data.accuracy
                }]);

                foundCount++;
                this.logger.debug(`✅ "${token}" → "${data.synonym}" (${data.accuracy}%)`);
              } else {
                synonymMap.set(token, []);
                notFoundCount++;
                this.logger.debug(`❌ No synonym for "${token}"`);
              }
            });
            this.logger.log(`Batch ${batchIndex + 1}: Found ${foundCount}, Not found ${notFoundCount}`);

          } else {
            this.logger.error(`Invalid response format for batch ${batchIndex + 1}`);

            // Fallback: đánh dấu tất cả tokens trong batch này là không tìm thấy
            batch.forEach(token => {
              if (!synonymMap.has(token)) {
                synonymMap.set(token, []);
              }
            });
          }

          // Delay nhẹ giữa các batch để tránh quá tải server
          if (batchIndex < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }

        } catch (error) {
          this.logger.error(`❌ Error processing batch ${batchIndex + 1}: ${error.message}`);

          // Fallback: đánh dấu tất cả tokens trong batch này là không tìm thấy
          batch.forEach(token => {
            if (!synonymMap.has(token)) {
              synonymMap.set(token, []);
            }
          });
        }
      }

      // Đảm bảo tất cả tokens đều có entry trong map
      tokens.forEach(token => {
        if (!synonymMap.has(token)) {
          synonymMap.set(token, []);
        }
      });

      const totalFound = Array.from(synonymMap.values()).filter(arr => arr.length > 0).length;
      const totalNotFound = tokens.length - totalFound;

      this.logger.log(`✅ Synonym map created: ${totalFound} found, ${totalNotFound} not found`);

      // --- STEP 4: Process Each Word ---
      this.logger.log(`Step 4: Processing words through Google Colab API...`);

      const allGestureCodes: any[] = [];
      const processedWordsInfo: any[] = [];
      const skippedWords: string[] = [];

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        try {
          console.log(`\n=== PROCESSING WORD ${i + 1}/${tokens.length}: "${token}" ===`);

          // Kiểm tra cache trong Word collection
          let existingWord = await this.wordModel.findOne({ word: token });

          if (existingWord && existingWord.code) {
            console.log(`✅ Found in cache: "${token}"`);

            existingWord.usageCount += 1;
            await existingWord.save();

            // Fetch gesture code from cached URL
            try {
              const gestureResponse = await firstValueFrom(
                this.httpService.get(existingWord.code)
              );

              allGestureCodes.push({
                word: token,
                gestureData: gestureResponse.data,
                cached: true,
                accuracy: existingWord.accuracy,
                gross: existingWord.gross
              });

              processedWordsInfo.push({
                word: token,
                cached: true,
                accuracy: existingWord.accuracy,
                gross: existingWord.gross
              });

              this.logger.log(`Word "${token}" found in cache, reusing existing data`);
              continue;
            } catch (fetchError) {
              this.logger.warn(`Failed to fetch cached gesture for "${token}", reprocessing...`);
            }
          }

          console.log(`📝 Not in cache, need to process: "${token}"`);

          const synonymArray = synonymMap.get(token) || [];

          console.log(`Synonym data found: ${synonymArray.length} results`);

          if (synonymArray.length === 0) {
            this.logger.warn(`⚠️ Skipping word "${token}" - no synonym data found`);
            skippedWords.push(token);
            processedWordsInfo.push({
              word: token,
              cached: false,
              skipped: true,
              reason: 'No synonym data found'
            });
            continue;
          }

          console.log(`Available synonyms for "${token}":`);
          synonymArray.forEach((syn, idx) => {
            console.log(`  ${idx + 1}. ${syn.gross || 'N/A'} - Accuracy: ${syn.accuracy}%`);
          });

          // Process word
          const wordData = await this.processSingleWord(token, synonymArray);

          if (wordData?.code && wordData?.gestureData) {
            console.log(`💾 Saving word "${token}" to database...`);

            // Save to Word collection for caching
            const newWord = new this.wordModel({
              word: token,
              code: wordData.code, // URL to gesture data
              originalVideoUrl: wordData.originalVideoUrl,
              accuracy: wordData.accuracy,
              gross: wordData.gross,
              tags: ['auto-generated'],
              usageCount: 1
            });

            await newWord.save();

            // Add to gesture codes array
            allGestureCodes.push({
              word: token,
              gestureData: wordData.gestureData,
              cached: false,
              accuracy: wordData.accuracy,
              gross: wordData.gross
            });

            processedWordsInfo.push({
              word: token,
              cached: false,
              accuracy: wordData.accuracy,
              gross: wordData.gross
            });

            this.logger.log(`✅ Successfully processed and saved word: "${token}"`);
          } else {
            this.logger.warn(`⚠️ No code returned for word "${token}"`);
            processedWordsInfo.push({
              word: token,
              cached: false,
              skipped: true,
              reason: 'Processing failed - no code returned'
            });
          }

        } catch (wordError) {
          this.logger.error(`❌ Error processing word "${token}": ${wordError.message}`);
          processedWordsInfo.push({
            word: token,
            cached: false,
            skipped: true,
            reason: wordError.message
          });
        }
      }

      // --- STEP 5: Upload combined gesture codes to Media ---
      this.logger.log(`Step 5: Uploading combined gesture codes to Media...`);

      const combinedGestureCodesUrl = await this.uploadCombinedGestureCodes(
        videoUrl,
        allGestureCodes
      );

      // --- STEP 6: Save video info ---
      const processingTime = Date.now() - startTime;

      console.log('\n=== PROCESSING SUMMARY ===');
      console.log('Total tokens:', tokens.length);
      console.log('Successfully processed:', processedWordsInfo.filter(w => !w.skipped).length);
      console.log('Skipped words:', skippedWords.length);
      if (skippedWords.length > 0) {
        console.log('Skipped word list:', skippedWords.join(', '));
      }
      console.log('Total processing time:', processingTime, 'ms');
      console.log('Combined gesture codes URL:', combinedGestureCodesUrl);

      let videoRecord = await this.videoModel.findOne({ videoUrl });

      if (videoRecord) {
        videoRecord.wordCodes = combinedGestureCodesUrl; // ✅ Store single URL
        videoRecord.processedWords = tokens;
        videoRecord.subtitleText = subtitleText;
        videoRecord.totalProcessingTime = processingTime;
        await videoRecord.save();
        this.logger.log('Updated existing video record');
      } else {
        videoRecord = new this.videoModel({
          videoUrl: videoUrl,
          wordCodes: combinedGestureCodesUrl, // ✅ Store single URL
          processedWords: tokens,
          subtitleText: subtitleText,
          totalProcessingTime: processingTime
        });
        await videoRecord.save();
        this.logger.log('Created new video record');
      }


      return this.getGestureCode(videoUrl);

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

  // Pipeline cũ được tách thành method riêng, gọi cho mỗi segment chưa khớp trie
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
    const tokens: string[] = postagRes.pos_tags
      .filter(([, tag]: [string, string]) => validPosTags.includes(tag))
      .map(([word]: [string, string]) => word.trim());
    // Thay đổi token đầu tiên thành P nếu tag của nó là N hoặc Np 
    if (tokens.length > 0) {
      const firstTag = postagRes.pos_tags.find(([, tag]: [string, string]) => tag === 'N' || tag === 'Np');
      if (firstTag) {
        const firstWord = firstTag[0].trim();
        tokens[0] = firstWord; // Giữ nguyên từ nhưng đổi tag thành P trong bước lookup
      }
    }
    if (tokens.length === 0) return [];

    //In ra từ và tag để debug
    console.log(`Tokens for segment "${text}": ${tokens.join(', ')} with tags ${postagRes.pos_tags.map(([w, t]) => `${w}/${t}`).join(', ')}`);
    // --- BƯỚC 3: Lookup video URL theo batch ---
    const synonymEndpoint = `${this.SYNONISM_URL}/search`;
    const synonymMap = new Map<string, { gross: string; url: string }>();
    const MAX_BATCH_SIZE = 100;

    for (let i = 0; i < tokens.length; i += MAX_BATCH_SIZE) {
      const batch = tokens.slice(i, i + MAX_BATCH_SIZE);
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

        if (i + MAX_BATCH_SIZE < tokens.length) {
          await new Promise(r => setTimeout(r, 500));
        }
      } catch (error) {
        this.logger.error(`❌ Batch ${batchIndex + 1} error: ${error.message}`);
      }
    }

    // --- BƯỚC 4: Ghép theo đúng thứ tự tokens ---
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
      return this.mediaUrlHelper.constructObjectUrls(video.toObject(), ['wordCodes']);
    }
    console.log("Chua co video trong db, goi getGestureCode với videoUrl: ", videoUrl)
    return this.getGestureCode(videoUrl);
  }
}