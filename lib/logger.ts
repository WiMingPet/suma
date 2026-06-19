// lib/logger.ts
import { CapacitorHttp } from '@capacitor/core';

const LOG_API_URL = 'https://suma.zeabur.app/api/log';

interface LogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  stack?: string;
  url?: string;
  extra?: any;
}

export async function sendLog(entry: LogEntry) {
  try {
    // ✅ 使用 CapacitorHttp.post 替代 fetch
    await CapacitorHttp.post({
      url: LOG_API_URL,
      headers: { 'Content-Type': 'application/json' },
      data: {
        ...entry,
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    // 静默失败，避免日志本身影响 App 功能
  }
}

export const logger = {
  info: (message: string, extra?: any) => {
    console.log('[App]', message, extra);
    sendLog({ level: 'info', message, extra });
  },
  warn: (message: string, extra?: any) => {
    console.warn('[App]', message, extra);
    sendLog({ level: 'warn', message, extra });
  },
  error: (message: string, error?: Error, extra?: any) => {
    console.error('[App]', message, error, extra);
    sendLog({
      level: 'error',
      message,
      stack: error?.stack,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      extra,
    });
  },
};