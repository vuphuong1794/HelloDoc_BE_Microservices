import { Inject, Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { HttpService } from '@nestjs/axios';
import { ClientProxy } from '@nestjs/microservices';
import { Word } from 'apps/sign-language/core/schema/word.schema';
import { Video } from 'apps/sign-language/core/schema/sign_language.schema';
import { get } from 'http';

@Injectable()
export class SignLanguageService {
  private readonly logger = new Logger(SignLanguageService.name);
  private SYNONISM_URL = "https://demoded-lourie-unpoulticed.ngrok-free.dev";
  private PHOWHISPER_URL = process.env.PHOWHISPER_URL;
  private DETECT_URL = "https://lorriane-noncongregative-benson.ngrok-free.dev";

  constructor(
    private readonly httpService: HttpService,
    @InjectModel(Word.name, "signLanguageConnection") private wordModel: Model<Word>,
    @InjectModel(Video.name, "signLanguageConnection") private videoModel: Model<Video>,
    @Inject("PHOWHISPER_CLIENT") private phowhisperClient: ClientProxy,
    @Inject("UNDERTHESEA_CLIENT") private undertheseaClient: ClientProxy,
    @Inject("CLOUDINARY_CLIENT") private cloudinaryService: ClientProxy,
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
    return { wordCodes: "https://res.cloudinary.com/dfklyndun/raw/upload/v1767809750/sign-language/videos/video_gestures_aHR0cHM6Ly9yZXMuY2xv_1767809749697.json" };
    this.logger.log(`Processing gesture code for video URL: ${videoUrl}`);
    const startTime = Date.now();

    // 1. Kiểm tra cache trong Video collection
    const cachedVideo = await this.videoModel.findOne({ videoUrl }).populate('wordCodes');

    if (cachedVideo && cachedVideo.wordCodes.length > 0) {
      this.logger.log("Found cached data for video");
      const wordCodes = await Promise.all(
        cachedVideo.wordCodes.map(async (wordId) => {
          const word = await this.wordModel.findById(wordId);
          return {
            word: word?.word,
            code: word?.code,
            originalVideoUrl: word?.originalVideoUrl,
            accuracy: word?.accuracy,
            gross: word?.gross
          };
        })
      );

      return {
        cached: true,
        videoUrl: cachedVideo.videoUrl,
        subtitleText: cachedVideo.subtitleText,
        processedWords: cachedVideo.processedWords,
        wordCodes: wordCodes,
        totalProcessingTime: cachedVideo.totalProcessingTime
      };
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

      const wordObjectIds: Types.ObjectId[] = [];
      const processedWordsInfo: any[] = [];
      const skippedWords: string[] = [];

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        try {
          console.log(`\n=== PROCESSING WORD ${i + 1}/${tokens.length}: "${token}" ===`);

          // Kiểm tra nếu từ đã tồn tại trong database
          let existingWord = await this.wordModel.findOne({ word: token });

          if (existingWord) {
            console.log(`✅ Found in cache: "${token}"`);

            existingWord.usageCount += 1;
            await existingWord.save();
            wordObjectIds.push(existingWord._id as Types.ObjectId);

            processedWordsInfo.push({
              word: token,
              code: existingWord.code,
              cached: true,
              accuracy: existingWord.accuracy,
              gross: existingWord.gross
            });

            this.logger.log(`Word "${token}" found in cache, reusing existing data`);
            continue;
          }

          console.log(`📝 Not in cache, need to process: "${token}"`);

          // ✅ LẤY SYNONYM DATA TỪ MAP
          let synonymForToken = synonymMap.get(token);

          // Nếu không tìm thấy, thử với normalized token
          if (!synonymForToken) {
            const normalizedToken = token.trim().toLowerCase();
            synonymForToken = synonymMap.get(normalizedToken);
            console.log(`Tried normalized token "${normalizedToken}":`, !!synonymForToken);
          }

          // Nếu vẫn không có, thử lấy theo index (fallback)
          if (!synonymForToken && Array.isArray(synonymsData.results) && i < synonymsData.results.length) {
            console.log(`⚠️ Falling back to index-based access for token "${token}"`);
            synonymForToken = synonymsData.results[i];
          }

          console.log('Synonym data found:', !!synonymForToken);

          if (synonymForToken) {
            console.log('Synonym data type:', typeof synonymForToken);
            console.log('Is array:', Array.isArray(synonymForToken));
            console.log('Data preview:', JSON.stringify(synonymForToken).substring(0, 200));
          }

          // Validation
          if (!synonymForToken) {
            this.logger.warn(`⚠️ Skipping word "${token}" - no synonym data found`);

            skippedWords.push(token);
            processedWordsInfo.push({
              word: token,
              code: null,
              cached: false,
              skipped: true,
              reason: 'No synonym data found'
            });

            continue;
          }

          // ✅ CHUẨN HÓA SYNONYM DATA
          // Nếu synonymForToken không phải array, wrap nó thành array
          let synonymArray: any[];

          if (Array.isArray(synonymForToken)) {
            synonymArray = synonymForToken;
          } else if (typeof synonymForToken === 'object' && synonymForToken !== null) {
            // Nếu là object đơn, wrap thành array
            synonymArray = [synonymForToken];
          } else {
            this.logger.warn(`⚠️ Invalid synonym data type for "${token}"`);
            skippedWords.push(token);
            processedWordsInfo.push({
              word: token,
              code: null,
              cached: false,
              skipped: true,
              reason: 'Invalid synonym data type'
            });
            continue;
          }

          // Kiểm tra array có rỗng không
          if (synonymArray.length === 0) {
            this.logger.warn(`⚠️ Empty synonym array for "${token}"`);
            skippedWords.push(token);
            processedWordsInfo.push({
              word: token,
              code: null,
              cached: false,
              skipped: true,
              reason: 'Empty synonym array'
            });
            continue;
          }

          console.log(`✅ Valid synonym data found for "${token}"`);
          console.log('Synonym array length:', synonymArray.length);
          console.log('First synonym:', synonymArray[0]);

          // Tiếp tục xử lý từ qua Colab API
          const wordData = await this.processSingleWord(token, synonymArray);

          console.log('wordData returned:', wordData ? 'Success' : 'Failed');

          if (wordData?.code) {
            console.log(`💾 Saving word "${token}" to database...`);

            const newWord = new this.wordModel({
              word: token,
              code: wordData.code,
              originalVideoUrl: wordData.originalVideoUrl,
              accuracy: wordData.accuracy,
              gross: wordData.gross,
              tags: ['auto-generated'],
              usageCount: 1
            });

            const savedWord = await newWord.save();
            wordObjectIds.push(savedWord._id as Types.ObjectId);

            processedWordsInfo.push({
              word: token,
              code: wordData.code,
              cached: false,
              accuracy: wordData.accuracy,
              gross: wordData.gross
            });

            this.logger.log(`✅ Successfully processed and saved word: "${token}"`);
            console.log(`✅ Word "${token}" saved with ID: ${savedWord._id}`);
          } else {
            this.logger.warn(`⚠️ No code returned for word "${token}"`);
            console.log(`⚠️ wordData:`, wordData);

            processedWordsInfo.push({
              word: token,
              code: null,
              cached: false,
              skipped: true,
              reason: 'Processing failed - no code returned'
            });
          }

        } catch (wordError) {
          this.logger.error(`❌ Error processing word "${token}": ${wordError.message}`);
          console.error('Full error details:', wordError);

          processedWordsInfo.push({
            word: token,
            code: null,
            cached: false,
            skipped: true,
            reason: wordError.message
          });
        }
      }

      // --- STEP 5: Lưu thông tin video ---
      const processingTime = Date.now() - startTime;

      console.log('\n=== PROCESSING SUMMARY ===');
      console.log('Total tokens:', tokens.length);
      console.log('Successfully processed:', processedWordsInfo.filter(w => !w.skipped).length);
      console.log('Skipped words:', skippedWords.length);
      if (skippedWords.length > 0) {
        console.log('Skipped word list:', skippedWords.join(', '));
      }
      console.log('Total processing time:', processingTime, 'ms');

      // ✅ SỬA: Kiểm tra và update hoặc tạo mới
      let videoRecord = await this.videoModel.findOne({ videoUrl });

      if (videoRecord) {
        // Nếu đã tồn tại, update thông tin
        console.log('Video already exists, updating...');

        videoRecord.wordCodes = wordObjectIds;
        videoRecord.processedWords = tokens;
        videoRecord.subtitleText = subtitleText;
        videoRecord.totalProcessingTime = processingTime;

        await videoRecord.save();

        this.logger.log('Updated existing video record');
      } else {
        // Nếu chưa tồn tại, tạo mới
        console.log('Creating new video record...');

        videoRecord = new this.videoModel({
          videoUrl: videoUrl,
          wordCodes: wordObjectIds,
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

  private async processSingleWord(word: string, synonymData: any): Promise<any> {
    if (!synonymData || !Array.isArray(synonymData) || synonymData.length === 0) {
      throw new Error(`No synonym data found for word: ${word}`);
    }

    const videoUrl = synonymData[0].url;
    const accuracy = synonymData[0].accuracy;
    const gross = synonymData[0].gross;

    this.logger.log(`Processing word: "${word}" - URL: ${videoUrl}`);

    try {
      // Gửi yêu cầu đến API Google Colab
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

      // Polling cho job completion
      const gestureData = await this.pollForJobCompletion(colabApiUrl, jobId, word);

      if (!gestureData) {
        throw new Error(`Failed to get gesture data for word: ${word}`);
      }

      // Upload gesture data lên Cloudinary
      const cloudinaryUrl = await this.uploadGestureToCloudinary(word, gestureData);

      return {
        word: word,
        code: cloudinaryUrl,
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

  private async uploadGestureToCloudinary(word: string, gestureData: any): Promise<string> {
    try {
      const jsonString = JSON.stringify(gestureData, null, 2);

      const uploadResponse = await firstValueFrom(
        this.cloudinaryService.send(
          'cloudinary.upload-json',
          {
            jsonData: jsonString,
            publicId: `gesture_${word}_${Date.now()}`,
            folder: 'sign-language/gestures',
            tags: ['sign-language', 'gesture', word],
            resource_type: 'raw'
          }
        )
      );

      return uploadResponse.secure_url || uploadResponse.url;

    } catch (error) {
      this.logger.error(`Error uploading to Cloudinary for word "${word}": ${error.message}`);
      throw error;
    }
  }

  // Các helper methods cho việc query dữ liệu
  async getWordByWord(word: string) {
    return await this.wordModel.findOne({ word });
  }

  async getVideoByUrl(videoUrl: string) {
    return await this.videoModel.findOne({ videoUrl }).populate('wordCodes');
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
      .limit(limit)
      .populate('wordCodes');
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
      return { wordCodes: video.wordCodes };
    }
    console.log("Chua co video trong db, goi getGestureCode với videoUrl: ", videoUrl)
    return this.getGestureCode(videoUrl);
  }
}