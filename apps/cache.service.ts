import { Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class CacheService {
    constructor(
        @Inject(CACHE_MANAGER) private cacheManager: Cache
    ) { }

    // Set cache with a specific key and value
    async setCache(key: string, value: any, ttl: number): Promise<void> {
        await this.cacheManager.set(key, value, ttl);
    }

    // Get cache by key
    async getCache(key: string): Promise<any> {
        return await this.cacheManager.get(key);
    }

    // Delete cache by key
    async deleteCache(key: string): Promise<void> {
        await this.cacheManager.del(key);
    }

    // Check if cache exists
    async hasCache(key: string): Promise<boolean> {
        const value = await this.cacheManager.get(key);
        return value !== undefined && value !== null;
    }
}
