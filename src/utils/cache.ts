import LZString from 'lz-string';
import type { Cable } from '../models/Cable';

export interface CacheMetadata {
  timestamp: number;
  version: string;
  size: number;        // Original data size (uncompressed)
  compressedSize: number; // Compressed data size
  compressed: boolean;
}

export interface CacheEntry {
  metadata: CacheMetadata;
  data: string; // Always stored as compressed string
}

/**
 * Cache utilities for localStorage with compression support
 */
export class CacheManager {
  private static readonly CACHE_PREFIX = 'mapping_infra_cache_';
  private static readonly DEFAULT_VERSION = 'v1';

  /**
   * Check if data will fit in localStorage
   */
  private static willFitInStorage(data: string): boolean {
    const testKey = '__storage_test__';
    try {
      localStorage.setItem(testKey, data);
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get total localStorage usage in bytes
   */
  static getStorageUsage(): number {
    let total = 0;
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(this.CACHE_PREFIX)) {
        const value = localStorage.getItem(key);
        if (value) {
          total += key.length + value.length;
        }
      }
    }
    return total;
  }

  /**
   * Compress data using LZString
   */
  private static compressData(data: unknown): string {
    return LZString.compress(JSON.stringify(data));
  }

  /**
   * Decompress data using LZString
   */
  private static decompressData<T>(compressed: string): T {
    const decompressed = LZString.decompress(compressed);
    if (!decompressed) {
      throw new Error('Failed to decompress cached data');
    }
    return JSON.parse(decompressed);
  }

  /**
   * Get cached data by key
   */
  static getCachedData(key: string): CacheEntry | null {
    try {
      const fullKey = this.CACHE_PREFIX + key;
      const cached = localStorage.getItem(fullKey);
      if (!cached) return null;

      const entry: CacheEntry = JSON.parse(cached);
      return entry;
    } catch (error) {
      console.warn('Failed to retrieve cached data:', error);
      return null;
    }
  }

  /**
   * Store data in cache with compression
   */
  static setCachedData(key: string, data: unknown, version: string = this.DEFAULT_VERSION): boolean {
    try {
      const originalData = JSON.stringify(data);
      const compressedData = this.compressData(data);

      // Check if compressed data will fit
      if (!this.willFitInStorage(compressedData)) {
        console.warn(`Data too large for localStorage (${compressedData.length} bytes compressed)`);
        return false;
      }

      const entry: CacheEntry = {
        metadata: {
          timestamp: Date.now(),
          version,
          size: originalData.length,
          compressedSize: compressedData.length,
          compressed: true
        },
        data: compressedData
      };

      const fullKey = this.CACHE_PREFIX + key;
      localStorage.setItem(fullKey, JSON.stringify(entry));

      console.log(`Cached data: ${key} (${originalData.length} → ${compressedData.length} bytes, ${(compressedData.length / originalData.length * 100).toFixed(1)}% of original)`);
      return true;
    } catch (error) {
      console.warn('Failed to cache data:', error);
      return false;
    }
  }

  /**
   * Check if cache entry is still valid
   */
  static isCacheValid(entry: CacheEntry, maxAgeMs: number): boolean {
    const age = Date.now() - entry.metadata.timestamp;
    const isExpired = age > maxAgeMs;

    if (isExpired) {
      console.log(`Cache expired: ${age}ms old (max: ${maxAgeMs}ms)`);
    }

    return !isExpired;
  }

  /**
   * Retrieve and decompress cached data
   */
  static getDecompressedData<T>(key: string): T | null {
    const entry = this.getCachedData(key);
    if (!entry) return null;

    try {
      return this.decompressData<T>(entry.data);
    } catch (error) {
      console.warn('Failed to decompress cached data:', error);
      this.clearCache(key); // Remove corrupted cache
      return null;
    }
  }

  /**
   * Clear specific cache entry or all cache entries
   */
  static clearCache(key?: string): void {
    try {
      if (key) {
        const fullKey = this.CACHE_PREFIX + key;
        localStorage.removeItem(fullKey);
        console.log(`Cleared cache: ${key}`);
      } else {
        // Clear all cache entries
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const storageKey = localStorage.key(i);
          if (storageKey && storageKey.startsWith(this.CACHE_PREFIX)) {
            keysToRemove.push(storageKey);
          }
        }
        keysToRemove.forEach(storageKey => localStorage.removeItem(storageKey));
        console.log(`Cleared all cache entries (${keysToRemove.length} items)`);
      }
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): { entries: number; totalSize: number; usagePercent: number } {
    let entries = 0;
    let totalSize = 0;

    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(this.CACHE_PREFIX)) {
        entries++;
        const value = localStorage.getItem(key);
        if (value) {
          totalSize += key.length + value.length;
        }
      }
    }

    // Estimate localStorage quota (rough approximation)
    const estimatedQuota = 5 * 1024 * 1024; // 5MB
    const usagePercent = (totalSize / estimatedQuota) * 100;

    return { entries, totalSize, usagePercent };
  }
}

/**
 * Specialized cache functions for cable data
 */
export const CableCache = {
  CACHE_KEY: 'wfs-cable-data',
  CACHE_DURATION: 24 * 60 * 60 * 1000, // 24 hours

  /**
   * Get cached cable data if valid
   */
  get(): Cable[] | null {
    const entry = CacheManager.getCachedData(this.CACHE_KEY);
    if (!entry) return null;

    if (!CacheManager.isCacheValid(entry, this.CACHE_DURATION)) {
      return null;
    }

    return CacheManager.getDecompressedData<Cable[]>(this.CACHE_KEY);
  },

  /**
   * Cache cable data
   */
  set(data: Cable[]): boolean {
    return CacheManager.setCachedData(this.CACHE_KEY, data, 'v1');
  },

  /**
   * Clear cable cache
   */
  clear(): void {
    CacheManager.clearCache(this.CACHE_KEY);
  }
};