import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';

export interface ClassificationResult {
  text: string;
  tokens: string[];
  pos_tags: Array<[string, string]>;
  success: boolean;
  error?: string;
}

@Injectable()
export class UndertheseaService {
  private colab_url = process.env.COLAB_URL || 'https://myles-undeliverable-symbolically.ngrok-free.dev';

  async classifyPOS(text: string): Promise<ClassificationResult> {
    try {
      const response = await axios.post(`${this.colab_url}/classify/pos`, { text });
      return {
        text,
        tokens: response.data.tokens,
        pos_tags: response.data.pos_tags,
        success: true,
      };
    } catch (error) {
      console.error('Classification error:', error.message);
      return {
        text,
        tokens: [],
        pos_tags: [],
        success: false,
        error: error.message,
      };
    }
  }

  async tokenize(text: string) {
    try {
      const response = await axios.post(`${this.colab_url}/classify/tokenize`, { text });
      return { tokens: response.data.tokens, success: true };
    } catch (error) {
      console.error('Tokenize error:', error.message);
      return { tokens: [], success: false, error: error.message };
    }
  }

  async classifyText(text: string) {
    try {
      const response = await axios.post(`${this.colab_url}/classify/text`, { text });
      return { classification: response.data.classification, success: true };
    } catch (error) {
      console.error('Classify text error:', error.message);
      return { classification: null, success: false, error: error.message };
    }
  }

  async checkHealth() {
    try {
      const response = await axios.get(`${this.colab_url}/health`);
      return { status: 'ok', message: 'Colab server is running' };
    } catch (error) {
      return {
        status: 'error',
        message: 'Colab server is not available',
        error: error.message
      };
    }
  }
}