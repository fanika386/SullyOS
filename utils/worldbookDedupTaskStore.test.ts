import { beforeEach, describe, expect, it, vi } from 'vitest';
import { worldbookDedupTaskStore } from './worldbookDedupTaskStore';

const STORAGE_KEY = 'sullyos.worldbook.dedupTask.v1';

beforeEach(() => {
    localStorage.clear();
    worldbookDedupTaskStore.reset();
});

describe('worldbook dedup task store', () => {
    it('begin 后进入 running 并持久化到 localStorage', () => {
        worldbookDedupTaskStore.begin({
            selectedBookIds: ['book-a', 'book-b'],
            analysis: null,
            aiChoiceId: 'main',
            result: 'AI 深度检查已在后台运行…',
        });

        const state = worldbookDedupTaskStore.get();
        expect(state.status).toBe('running');
        expect(state.selectedBookIds).toEqual(['book-a', 'book-b']);
        expect(state.aiChoiceId).toBe('main');

        const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
        expect(persisted.status).toBe('running');
        expect(persisted.selectedBookIds).toEqual(['book-a', 'book-b']);
    });

    it('完成后写入结果，reset 清空内存与持久化', () => {
        worldbookDedupTaskStore.begin({
            selectedBookIds: ['book-a'],
            analysis: null,
            aiChoiceId: 'main',
            result: 'running',
        });
        worldbookDedupTaskStore.set({
            status: 'done',
            progress: null,
            result: '[ok]AI 深度检查完成：1 组建议',
            finishedAt: Date.now(),
        });

        expect(worldbookDedupTaskStore.get().status).toBe('done');
        expect(worldbookDedupTaskStore.get().result).toContain('1 组建议');
        expect(localStorage.getItem(STORAGE_KEY)).toContain('"status":"done"');

        worldbookDedupTaskStore.reset();
        expect(worldbookDedupTaskStore.get().status).toBe('idle');
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('整页刷新后 running 任务会被标记为 interrupted', async () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            status: 'running',
            selectedBookIds: ['book-a', 'book-b'],
            analysis: null,
            aiResult: null,
            aiChoiceId: 'main',
            progress: { label: '正在请求 AI…' },
            result: 'running',
            startedAt: 1,
            updatedAt: 1,
        }));

        vi.resetModules();
        const fresh = await import('./worldbookDedupTaskStore');
        const state = fresh.worldbookDedupTaskStore.get();
        expect(state.status).toBe('interrupted');
        expect(state.result).toContain('中断');
        expect(state.progress).toBeNull();
        expect(state.selectedBookIds).toEqual(['book-a', 'book-b']);
    });
});
