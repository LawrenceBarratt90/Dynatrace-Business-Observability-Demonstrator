/**
 * History Store — append‑only JSONL log of all agent events.
 * Each agent writes structured events; Librarian queries them.
 */

import fs from 'fs';
import path from 'path';
import { config } from '../../utils/config.js';
import { createLogger, AgentName } from '../../utils/logger.js';

const log = createLogger('librarian');

// ─── Types ────────────────────────────────────────────────────

export type EventKind =
  | 'chaos_injected'
  | 'chaos_reverted'
  | 'problem_detected'
  | 'diagnosis_started'
  | 'diagnosis_complete'
  | 'fix_proposed'
  | 'fix_executed'
  | 'fix_verified'
  | 'fix_failed'
  | 'learning_stored';

export interface HistoryEvent {
  id: string;
  timestamp: string;
  agent: AgentName;
  kind: EventKind;
  summary: string;
  details: Record<string, unknown>;
  relatedIds?: string[];   // link chaos → problem → fix chains
}

// ─── Store ────────────────────────────────────────────────────

export class HistoryStore {
  private filePath: string;
  private dirPath: string;

  constructor(storeName = 'events') {
    // Use configured memory location so runtime never writes into dist/.
    this.dirPath = path.resolve(process.cwd(), config.memory.historyDir, 'data');
    if (!fs.existsSync(this.dirPath)) fs.mkdirSync(this.dirPath, { recursive: true });
    this.filePath = path.join(this.dirPath, `${storeName}.jsonl`);
  }

  private ensureStoreDir(): void {
    if (!fs.existsSync(this.dirPath)) fs.mkdirSync(this.dirPath, { recursive: true });
  }

  append(event: HistoryEvent): void {
    this.ensureStoreDir();
    fs.appendFileSync(this.filePath, JSON.stringify(event) + '\n');
    log.debug('History event appended', { id: event.id, kind: event.kind });
  }

  readAll(): HistoryEvent[] {
    this.ensureStoreDir();
    if (!fs.existsSync(this.filePath)) return [];
    const lines = fs.readFileSync(this.filePath, 'utf-8').trim().split('\n');
    return lines
      .filter(l => l.length > 0)
      .map(l => {
        try { return JSON.parse(l) as HistoryEvent; }
        catch { return null; }
      })
      .filter((e): e is HistoryEvent => e !== null);
  }

  readRecent(count: number): HistoryEvent[] {
    const all = this.readAll();
    return all.slice(-count);
  }

  findByKind(kind: EventKind): HistoryEvent[] {
    return this.readAll().filter(e => e.kind === kind);
  }

  findByAgent(agent: AgentName): HistoryEvent[] {
    return this.readAll().filter(e => e.agent === agent);
  }

  findRelated(id: string): HistoryEvent[] {
    return this.readAll().filter(
      e => e.id === id || e.relatedIds?.includes(id)
    );
  }

  get size(): number {
    if (!fs.existsSync(this.filePath)) return 0;
    const content = fs.readFileSync(this.filePath, 'utf-8');
    return content.trim().split('\n').filter(l => l.length > 0).length;
  }
}

export default HistoryStore;
