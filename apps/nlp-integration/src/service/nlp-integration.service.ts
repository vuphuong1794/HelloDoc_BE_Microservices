import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

// Mapping POS tags sang tên đầy đủ và loại quan hệ
const POS_TAG_INFO = {
  // Danh từ
  'N': { fullName: 'Noun', vnName: 'Danh từ' },
  'Np': { fullName: 'Proper Noun', vnName: 'Danh từ riêng' },
  'Nc': { fullName: 'Noun Category', vnName: 'Danh từ chỉ loại' },
  'Nu': { fullName: 'Noun Unit', vnName: 'Danh từ đơn vị' },
  'Ny': { fullName: 'Noun Abbreviation', vnName: 'Danh từ viết tắt' },
  'Nb': { fullName: 'Borrowed Noun', vnName: 'Danh từ mượn' },
  
  //Chủ từ
  'P': { fullName: 'Pronoun', vnName: 'Đại từ' },

  // Động từ
  'V': { fullName: 'Verb', vnName: 'Động từ' },
  'Vb': { fullName: 'Borrowed Verb', vnName: 'Động từ mượn' },
  'Vy': { fullName: 'Verb Abbreviation', vnName: 'Động từ viết tắt' },

  // Tính từ
  'A': { fullName: 'Adjective', vnName: 'Tính từ' },
  'Ab': { fullName: 'Borrowed Adjective', vnName: 'Tính từ mượn' },

  // Các loại từ khác
  'R': { fullName: 'Adverb', vnName: 'Phó từ' },
  'L': { fullName: 'Determiner', vnName: 'Định từ' },
  'M': { fullName: 'Numeral', vnName: 'Số từ' },
  'E': { fullName: 'Adposition', vnName: 'Giới từ' },
  'C': { fullName: 'Coordinating Conjunction', vnName: 'Liên từ' },
  'Cc': { fullName: 'Subordinating Conjunction', vnName: 'Liên từ đẳng lập' },
  'I': { fullName: 'Interjection', vnName: 'Thán từ' },
  'T': { fullName: 'Particle', vnName: 'Trợ từ' },
  'B': { fullName: 'Borrow', vnName: 'Từ mượn' },
  'FW': { fullName: 'Foreign Word', vnName: 'Từ nước ngoài' },
  'CH': { fullName: 'Chunk', vnName: 'Dấu câu' },
  'X': { fullName: 'Unknown', vnName: 'Không phân loại' },
  'Z': { fullName: 'Complex Word', vnName: 'Yếu tố cấu tạo từ' },
  'S': { fullName: 'School/Organization', vnName: 'Tên trường/tổ chức' },
  'Y': { fullName: 'Unknown Y', vnName: 'Loại Y' },
};

@Injectable()
export class NlpIntegrationService {
  constructor(
    @Inject('UNDERTHESEA_CLIENT') private readonly undertheseaClient: ClientProxy,
    @Inject('NEO4J_CLIENT') private readonly neo4jClient: ClientProxy,
  ) { }

  /*
   Phân tích văn bản và tạo graph trong Neo4j
   @param text - Văn bản cần phân tích
   @param createRelations - Có tạo quan hệ giữa các từ liên tiếp không
   */
  async analyzeAndCreateGraph(text: string, createRelations: boolean = true) {
    try {
      console.log('=== BẮT ĐẦU PHÂN TÍCH ===');
      console.log('Text:', text);
      console.log('Create Relations:', createRelations);

      // Bước 1: Phân tích POS
      console.log('Đang gọi underthesea.pos...');
      const posResult = await firstValueFrom(
        this.undertheseaClient.send('underthesea.pos', { text: text })
      );

      console.log('POS Result:', JSON.stringify(posResult, null, 2));

      if (!posResult || !posResult.success) {
        console.error('POS analysis failed:', posResult);
        throw new InternalServerErrorException('Không thể phân tích POS');
      }

      const { tokens, pos_tags } = posResult;
      console.log('Tokens:', tokens);
      console.log('POS Tags:', pos_tags);

      if (!tokens || !pos_tags || tokens.length === 0) {
        throw new InternalServerErrorException('POS result không có dữ liệu');
      }

      // Trích xuất chỉ POS tag từ mảng 2 chiều
      // pos_tags = [["tôi", "P"], ["ăn", "V"]] => ["P", "V"]
      const extractedPosTags = pos_tags.map(item => {
        if (Array.isArray(item)) {
          return item[1]; // Lấy phần tử thứ 2 (POS tag)
        }
        return item; // Nếu đã là string thì giữ nguyên
      });

      console.log('Extracted POS Tags:', extractedPosTags);

      const createdNodes = [];
      const createdRelations = [];

      // Bước 2: Tạo nodes cho mỗi token
      console.log('=== BẮT ĐẦU TẠO NODES ===');
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const posTag = extractedPosTags[i];

        console.log(`Đang tạo node ${i + 1}/${tokens.length}: "${token}" (${posTag})`);

        try {
          const nodePayload = {
            label: posTag,
            name: token,
          };
          console.log('Node payload:', nodePayload);

          const node = await firstValueFrom(
            this.neo4jClient.send('neo4j.create-node', nodePayload)
          );

          console.log('Node created:', node);

          createdNodes.push({
            token,
            posTag,
            posInfo: this.getPosTagInfo(posTag),
            node,
          });
        } catch (error) {
          console.error(`LỖI tạo node cho token "${token}":`, error);
          console.error('Error stack:', error.stack);
          throw error;
        }
      }

      console.log(`Đã tạo ${createdNodes.length} nodes`);

      // Bước 3: Tạo relations giữa các từ liên tiếp
      if (createRelations && tokens.length > 1) {
        console.log('=== BẮT ĐẦU TẠO RELATIONS ===');
        for (let i = 0; i < tokens.length - 1; i++) {
          console.log(`Tạo relation ${i + 1}/${tokens.length - 1}: "${tokens[i]}" -> "${tokens[i + 1]}"`);

          try {
            const relationPayload = {
              fromLabel: extractedPosTags[i],
              fromName: tokens[i],
              toLabel: extractedPosTags[i + 1],
              toName: tokens[i + 1],
              relationType: 'PRECEDES',
              weight: 1,
            };
            console.log('Relation payload:', relationPayload);

            const relation = await firstValueFrom(
              this.neo4jClient.send('neo4j.create-relation', relationPayload)
            );

            console.log('Relation created:', relation);
            createdRelations.push(relation);
          } catch (error) {
            console.error(`LỖI tạo relation: "${tokens[i]}" -> "${tokens[i + 1]}"`, error);
            console.error('Error stack:', error.stack);
          }
        }

        console.log(`Đã tạo ${createdRelations.length} relations`);
      }

      const result = {
        success: true,
        text,
        totalNodes: createdNodes.length,
        totalRelations: createdRelations.length,
        nodes: createdNodes,
        relations: createdRelations,
      };

      console.log('=== KẾT QUẢ CUỐI CÙNG ===');
      console.log(JSON.stringify(result, null, 2));

      return result;
    } catch (error) {
      console.error('LỖI NGHIÊM TRỌNG trong analyzeAndCreateGraph:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      throw new InternalServerErrorException(`Không thể tạo graph từ văn bản: ${error.message}`);
    }
  }

  private getPosTagInfo(posTag: string) {
    const POS_TAG_INFO = {
      'N': { fullName: 'Noun', vnName: 'Danh từ' },
      'Np': { fullName: 'Proper Noun', vnName: 'Danh từ riêng' },
      'Nc': { fullName: 'Noun Category', vnName: 'Danh từ chỉ loại' },
      'Nu': { fullName: 'Noun Unit', vnName: 'Danh từ đơn vị' },
      'V': { fullName: 'Verb', vnName: 'Động từ' },
      'Vb': { fullName: 'Borrowed Verb', vnName: 'Động từ mượn' },
      'A': { fullName: 'Adjective', vnName: 'Tính từ' },
      'Ab': { fullName: 'Borrowed Adjective', vnName: 'Tính từ mượn' },
      'P': { fullName: 'Pronoun', vnName: 'Đại từ' },
      'R': { fullName: 'Adverb', vnName: 'Phó từ' },
      'L': { fullName: 'Determiner', vnName: 'Định từ' },
      'M': { fullName: 'Numeral', vnName: 'Số từ' },
      'E': { fullName: 'Adposition', vnName: 'Giới từ' },
      'C': { fullName: 'Coordinating Conjunction', vnName: 'Liên từ' },
      'Cc': { fullName: 'Subordinating Conjunction', vnName: 'Liên từ đẳng lập' },
      'I': { fullName: 'Interjection', vnName: 'Thán từ' },
      'T': { fullName: 'Particle', vnName: 'Trợ từ' },
      'CH': { fullName: 'Chunk', vnName: 'Dấu câu' },
      'X': { fullName: 'Unknown', vnName: 'Không phân loại' },
    };
    return POS_TAG_INFO[posTag] || { fullName: posTag, vnName: posTag };
  }

  //Xác định loại quan hệ ngữ nghĩa giữa 2 từ dựa trên POS tags
  private determineRelationType(currentTag: string, nextTag: string): string {
    // Danh từ + Động từ: chủ ngữ - vị ngữ
    if (currentTag.startsWith('N') && nextTag.startsWith('V')) {
      return 'Noun_Verb';
    }

    // Động từ + Danh từ: động từ - tân ngữ
    if (currentTag.startsWith('V') && nextTag.startsWith('N')) {
      return 'Verb_Noun';
    }

    // Tính từ + Danh từ: bổ nghĩa
    if (currentTag.startsWith('A') && nextTag.startsWith('N')) {
      return 'Adjective_Noun';
    }

    // Phó từ + Động từ: bổ nghĩa
    if (currentTag === 'R' && nextTag.startsWith('V')) {
      return 'Adverb-Verb';
    }

    // Phó từ + Tính từ: bổ nghĩa
    if (currentTag === 'R' && currentTag.startsWith('A')) {
      return 'Adverb-Adjective';
    }

    // Giới từ + Danh từ: cụm giới từ
    if (currentTag === 'E' && nextTag.startsWith('N')) {
      return 'Adposition_Noun';
    }

    // Định từ + Danh từ: xác định
    if (currentTag === 'L' && nextTag.startsWith('N')) {
      return 'Determiner_Noun';
    }

    // Số từ + Danh từ: đếm/định lượng
    if (currentTag === 'M' && nextTag.startsWith('N')) {
      return 'Numeral_Noun';
    }

    // Số từ + Danh từ đơn vị: số + đơn vị
    if (currentTag === 'M' && nextTag === 'Nu') {
      return 'Numeral_Unit';
    }

    // Danh từ + Danh từ: cụm danh từ phức hợp
    if (currentTag.startsWith('N') && nextTag.startsWith('N')) {
      return 'Noun_Compound';
    }

    // Động từ + Động từ: chuỗi động từ
    if (currentTag.startsWith('V') && nextTag.startsWith('V')) {
      return 'Verb_Serial';
    }

    // Liên từ kết nối 2 thành phần
    if (currentTag === 'C' || currentTag === 'Cc') {
      return 'Conjuncts';
    }

    // Trợ từ
    if (currentTag === 'T') {
      return 'Particle';
    }

    // Mặc định
    return 'Related_To';
  }

  //Phân tích văn bản và tạo graph với các mối quan hệ ngữ nghĩa
  async analyzeAndCreateSemanticGraph(text: string) {
    try {
      const posResult = await firstValueFrom(
        this.undertheseaClient.send('underthesea.pos', { text: text })
      );

      if (!posResult.success) {
        throw new InternalServerErrorException('Không thể phân tích POS');
      }

      const { tokens, pos_tags } = posResult;

      //Trích xuất POS tags
      const extractedPosTags = pos_tags.map(item =>
        Array.isArray(item) ? item[1] : item
      );

      const createdNodes = [];
      const createdRelations = [];

      // Tạo nodes
      for (let i = 0; i < tokens.length; i++) {
        try {
          const node = await firstValueFrom(
            this.neo4jClient.send('neo4j.create-node', {
              label: extractedPosTags[i],
              name: tokens[i],
            })
          );
          createdNodes.push({
            token: tokens[i],
            posTag: extractedPosTags[i],
            posInfo: this.getPosTagInfo(extractedPosTags[i]),
            node,
          });
        } catch (error) {
          console.error(`Lỗi khi tạo node: ${error.message}`);
        }
      }

      // Tạo relations dựa trên ngữ nghĩa
      for (let i = 0; i < tokens.length - 1; i++) {
        const currentTag = extractedPosTags[i];
        const nextTag = extractedPosTags[i + 1];

        // Bỏ qua dấu câu
        if (currentTag === 'CH' || nextTag === 'CH') {
          continue;
        }

        const relationType = this.determineRelationType(currentTag, nextTag);

        try {
          const relation = await firstValueFrom(
            this.neo4jClient.send('neo4j.create-relation', {
              fromLabel: currentTag,
              fromName: tokens[i],
              toLabel: nextTag,
              toName: tokens[i + 1],
              relationType,
              weight: 1,
            })
          );
          createdRelations.push({
            ...relation,
            relationDescription: this.getRelationDescription(relationType),
          });
        } catch (error) {
          console.error(`Lỗi khi tạo relation: ${error.message}`);
        }
      }

      return {
        success: true,
        text,
        totalNodes: createdNodes.length,
        totalRelations: createdRelations.length,
        nodes: createdNodes,
        relations: createdRelations,
      };
    } catch (error) {
      console.error('Lỗi trong quá trình tạo semantic graph:', error);
      throw new InternalServerErrorException('Không thể tạo semantic graph');
    }
  }

  // Mô tả ý nghĩa của các loại quan hệ
  private getRelationDescription(relationType: string): string {
    const descriptions = {
      'SUBJECT_OF': 'là chủ ngữ của',
      'HAS_OBJECT': 'có tân ngữ là',
      'MODIFIES': 'bổ nghĩa cho',
      'PREPOSITION_OF': 'tạo cụm giới từ với',
      'DETERMINES': 'xác định',
      'QUANTIFIES': 'định lượng',
      'HAS_UNIT': 'có đơn vị',
      'COMPOUND_WITH': 'tạo cụm từ với',
      'SERIAL_VERB': 'nối tiếp với động từ',
      'CONJUNCTS': 'liên kết',
      'ASSISTS': 'hỗ trợ',
      'RELATES_TO': 'liên quan đến',
      'PRECEDES': 'đứng trước',
    };
    return descriptions[relationType] || relationType;
  }

  //Phân tích nhiều câu và tích lũy weight cho các mối quan hệ
  async buildKnowledgeGraph(texts: string[]) {
    const stats = {
      totalTexts: texts.length,
      successCount: 0,
      failCount: 0,
      totalNodes: 0,
      totalRelations: 0,
      errors: [],
    };

    for (const text of texts) {
      try {
        const result = await this.analyzeAndCreateSemanticGraph(text);
        if (result.success) {
          stats.successCount++;
          stats.totalNodes += result.totalNodes;
          stats.totalRelations += result.totalRelations;
        }
      } catch (error) {
        stats.failCount++;
        stats.errors.push({ text, error: error.message });
        console.error(`Lỗi khi xử lý văn bản "${text}":`, error.message);
      }
    }

    return stats;
  }

  // Lấy gợi ý từ tiếp theo dựa trên từ hiện tại và POS tag
  async getNextWordSuggestion(
    word: string,
    currentPosTag: string,
    targetPosTag?: string,
  ) {
    try {
      let suggestions;

      if (targetPosTag) {
        // Tìm từ có POS tag cụ thể
        suggestions = await this.neo4jClient.send('neo4j.get-suggestions', {
          word,
          currentPosTag,
          targetPosTag,
        }
        );
      } else {
        // Tìm tất cả các từ có thể xuất hiện sau
        suggestions = await this.neo4jClient.send('neo4j.get-suggestions', word);
      }

      return {
        success: true,
        word,
        currentPosTag,
        currentPosInfo: POS_TAG_INFO[currentPosTag] || null,
        targetPosTag: targetPosTag || 'all',
        suggestions,
      };
    } catch (error) {
      console.error('Lỗi khi lấy gợi ý:', error);
      throw new InternalServerErrorException('Không thể lấy gợi ý');
    }
  }

  //Phân tích cấu trúc câu cơ bản (S-V-O)
  async analyzeSentenceStructure(text: string) {
    try {
      const posResult = await firstValueFrom(this.undertheseaClient.send('underthesea.pos', { text: text }));

      if (!posResult.success) {
        throw new InternalServerErrorException('Không thể phân tích POS');
      }

      const { tokens, pos_tags } = posResult;
      const structure = {
        subject: [],
        verb: [],
        object: [],
        modifiers: [],
        others: [],
      };

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const tag = pos_tags[i];

        if (tag.startsWith('N') || tag === 'P') {
          // Kiểm tra xem có phải chủ ngữ không (trước động từ)
          const nextVerb = pos_tags.slice(i + 1).findIndex(t => t.startsWith('V'));
          if (nextVerb !== -1) {
            structure.subject.push({ token, tag });
          } else {
            structure.object.push({ token, tag });
          }
        } else if (tag.startsWith('V')) {
          structure.verb.push({ token, tag });
        } else if (tag.startsWith('A') || tag === 'R') {
          structure.modifiers.push({ token, tag });
        } else {
          structure.others.push({ token, tag });
        }
      }

      return {
        success: true,
        text,
        structure,
        summary: {
          hasSubject: structure.subject.length > 0,
          hasVerb: structure.verb.length > 0,
          hasObject: structure.object.length > 0,
          isComplete: structure.subject.length > 0 && structure.verb.length > 0,
        },
      };
    } catch (error) {
      console.error('Lỗi khi phân tích cấu trúc câu:', error);
      throw new InternalServerErrorException('Không thể phân tích cấu trúc câu');
    }
  }

  //Lấy thống kê về các POS tags trong văn bản
  async getPosStatistics(text: string) {
    try {
      const posResult = await firstValueFrom(this.undertheseaClient.send('underthesea.pos', { text: text }));

      if (!posResult.success) {
        throw new InternalServerErrorException('Không thể phân tích POS');
      }

      const { tokens, pos_tags } = posResult;
      const statistics = {};

      for (const tag of pos_tags) {
        if (!statistics[tag]) {
          statistics[tag] = {
            count: 0,
            percentage: 0,
            info: POS_TAG_INFO[tag] || { fullName: tag, vnName: tag },
            examples: [],
          };
        }
        statistics[tag].count++;

        const index = pos_tags.indexOf(tag);
        if (statistics[tag].examples.length < 3) {
          statistics[tag].examples.push(tokens[index]);
        }
      }

      // Tính phần trăm
      const total = tokens.length;
      for (const tag in statistics) {
        statistics[tag].percentage = ((statistics[tag].count / total) * 100).toFixed(2);
      }

      return {
        success: true,
        text,
        totalTokens: total,
        uniqueTags: Object.keys(statistics).length,
        statistics,
      };
    } catch (error) {
      console.error('Lỗi khi thống kê POS:', error);
      throw new InternalServerErrorException('Không thể thống kê POS');
    }
  }

  // Tìm từ trong graph và lấy thông tin liên quan
  async findWord(word: string) {
    try {
      const nodes = await firstValueFrom(
        this.neo4jClient.send('neo4j.get-suggestions', { word: word })
      );
      return {
        success: true,
        word,
        nodes,
      };
    } catch (error) {
      console.error('Lỗi khi tìm từ trong graph:', error);
      throw new InternalServerErrorException('Không thể tìm từ trong graph');
    }
  }
}