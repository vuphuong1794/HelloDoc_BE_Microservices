import { IsArray, IsString, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

// Đại diện cho 1 phần tử trong câu:
// - Nếu là string đơn  → từ/cụm từ cố định
// - Nếu là string[]   → danh sách candidates để PhoBERT chọn best match
export type SentenceToken = string | string[];

export class ProcessSentenceDto {
  @IsArray()
  @IsNotEmpty()
  tokens: SentenceToken[];
}
