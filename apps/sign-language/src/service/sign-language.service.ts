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

@Injectable()
export class SignLanguageService {
  private readonly logger = new Logger(SignLanguageService.name);
  private SYNONISM_URL = process.env.SYNNONISM_URL;
  private PHOWHISPER_URL = process.env.PHOWHISPER_URL;
  private DETECT_URL = process.env.DETECT_URL;

  constructor(
    private readonly httpService: HttpService,
    @InjectModel(Word.name, "signLanguageConnection") private wordModel: Model<Word>,
    @InjectModel(Video.name, "signLanguageConnection") private videoModel: Model<Video>,
    @Inject("PHOWHISPER_CLIENT") private phowhisperClient: ClientProxy,
    @Inject("UNDERTHESEA_CLIENT") private undertheseaClient: ClientProxy,
    @Inject('MEDIA_CLIENT') private mediaClient: ClientProxy,
    private readonly mediaUrlHelper: MediaUrlHelper,
  ) { }

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

      const validPosTags = ['N', 'Np', 'Nc', 'Nu', 'Ny', 'Nb', 'V', 'Vb', 'Vy', 'L', 'E', 'A', 'R', 'M', 'P', 'FW', 'B'];
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

  async getSignLanguageVideoPlaylist(text: string): Promise<Array<{ gross: string, url: string }>> {
    this.logger.log(`Processing text for sign language video playlist: "${text}"`);
    const startTime = Date.now();

    try {
      // --- BƯỚC 1: Bỏ qua (Đã nhận trực tiếp text đầu vào) ---

      // --- BƯỚC 2: Tokenize (Underthesea) ---
      this.logger.log(`Step 2: Tokenizing text...`);
      const postagRes = await firstValueFrom(
        this.undertheseaClient.send('underthesea.pos', { text: text })
      );

      if (!postagRes?.success || !Array.isArray(postagRes?.pos_tags)) {
        throw new Error("POSTag failed or returned invalid response");
      }

      const validPosTags = ['N', 'Np', 'Nc', 'Nu', 'Ny', 'Nb', 'V', 'Vb', 'Vy', 'L', 'E', 'A', 'R', 'M', 'P', 'FW', 'B'];
      const tokens = postagRes.pos_tags
        .filter(([word, tag]) => validPosTags.includes(tag))
        .map(([word, tag]) => word.trim());

      this.logger.debug(`Tokens extracted: ${tokens.join(', ')}`);

      if (tokens.length === 0) {
        this.logger.warn("No valid tokens found in the input text.");
        return [];
      }

      // --- BƯỚC 3: Lấy từ đồng nghĩa và URL Video ---
      const synonymEndpoint = `${this.SYNONISM_URL}/search`;
      this.logger.log(`Step 3: Getting video URLs for ${tokens.length} words...`);

      // Đổi kiểu Map để lưu trực tiếp object { gross, url }
      const synonymMap: Map<string, { gross: string, url: string }> = new Map();

      const MAX_BATCH_SIZE = 100;
      const batches: string[][] = [];

      for (let i = 0; i < tokens.length; i += MAX_BATCH_SIZE) {
        batches.push(tokens.slice(i, i + MAX_BATCH_SIZE));
      }

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];

        try {
          const synonymRes = await firstValueFrom(
            this.httpService.post(
              synonymEndpoint,
              { queries: batch },
              { timeout: 30000 }
            )
          );

          const results = synonymRes.data?.results;

          if (results && typeof results === 'object') {
            Object.entries(results).forEach(([token, data]: [string, any]) => {
              // CHỈ LƯU VÀO MAP NẾU TÌM THẤY VÀ CÓ URL (Bỏ qua từ không tìm thấy)
              if (data.found && data.url) {
                synonymMap.set(token, {
                  gross: data.synonym,
                  url: data.url
                });
                this.logger.debug(`✅ Mapped: "${token}" → "${data.synonym}"`);
              } else {
                this.logger.debug(`❌ No video found for "${token}", skipping.`);
              }
            });
          }

          // Delay nhẹ giữa các batch
          if (batchIndex < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }

        } catch (error) {
          this.logger.error(`❌ Error processing batch ${batchIndex + 1}: ${error.message}`);
          // Lỗi thì bỏ qua batch này, các token trong batch sẽ không có trong map
        }
      }

      // --- BƯỚC 4: Trả về mảng Object chứa gross và url theo đúng thứ tự câu ---
      this.logger.log(`Step 4: Building final video playlist...`);

      const videoPlaylist: Array<{ gross: string, url: string }> = [];
      const skippedWords: string[] = [];

      // Duyệt lại mảng tokens ban đầu để giữ đúng THỨ TỰ CỦA CÂU
      for (const token of tokens) {
        if (synonymMap.has(token)) {
          videoPlaylist.push(synonymMap.get(token)!);
        } else {
          skippedWords.push(token);
        }
      }

      const processingTime = Date.now() - startTime;
      this.logger.log(`✅ Playlist created in ${processingTime}ms. Found: ${videoPlaylist.length}, Skipped: ${skippedWords.length}`);
      if (skippedWords.length > 0) {
        this.logger.log(`Skipped words: ${skippedWords.join(', ')}`);
      }

      // Trả kết quả trực tiếp cho Client
      return videoPlaylist;

    } catch (error) {
      this.logger.error(`Failed to generate video playlist: ${error.message}`);
      throw error; // Ném lỗi ra để Controller xử lý (trả về 500 cho client)
    }
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