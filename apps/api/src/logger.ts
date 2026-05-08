import { config } from './config.js';

const levels = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof levels;

const minLevel = levels[config.LOG_LEVEL];

function emit(level: Level, msg: string, fields?: Record<string, unknown>) {
  if (levels[level] < minLevel) return;
  const entry = { level, msg, time: new Date().toISOString(), ...fields };
  process.stdout.write(JSON.stringify(entry) + '\n');
}

export const logger = {
  debug: (msg: string, f?: Record<string, unknown>) => emit('debug', msg, f),
  info: (msg: string, f?: Record<string, unknown>) => emit('info', msg, f),
  warn: (msg: string, f?: Record<string, unknown>) => emit('warn', msg, f),
  error: (msg: string, f?: Record<string, unknown>) => emit('error', msg, f),
};
