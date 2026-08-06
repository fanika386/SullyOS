/**
 * 全局「记忆宫殿去重任务」状态（按扫描范围隔离，互不覆盖）。
 *
 * 每个扫描范围（目前 UI 是单个角色）各自持有独立的进度 / 候选 / 结果：
 *   1. 扫描 / 删除过程中即使退出记忆宫殿 App（甚至切到别的 OS App），任务照常跑；
 *   2. 再点回记忆宫殿时，可以按角色读回自己的进度 / 候选 / 结果；
 *   3. 不同角色之间的去重任务互不影响，新扫描不会覆盖其他角色未处理的结果。
 * 状态会持久化到 localStorage，整页刷新后也能看到各自上次的结果（或中断提示）。
 *
 * v2 从单个任务槽升级为按角色隔离的多任务：旧版单任务数据会自动迁移。
 */
import { useSyncExternalStore } from 'react';
import type { CharacterDedupScanScope, ExactDuplicateMemoryPreview } from './deduplicate';

export type DedupMode = 'exact' | 'semantic' | 'ai';

export type DedupTaskStatus =
    | 'idle'        // 无任务
    | 'running'     // 扫描 / 删除中
    | 'review'      // 扫描完成，等待用户在审核面板里确认
    | 'done'        // 已完成（无重复，或删除完成）
    | 'error'       // 失败
    | 'interrupted'; // 上次任务因整页关闭而中断

export interface DedupTaskState {
    status: DedupTaskStatus;
    mode: DedupMode;
    scope: CharacterDedupScanScope;
    /** AI 模式记录当时选的 API 来源，回来审核时仍能还原上下文 */
    aiApiSource?: string;
    progress: { done: number; total: number; label: string; step?: string } | null;
    result: string | null;
    preview: ExactDuplicateMemoryPreview | null;
    startedAt: number;
    updatedAt: number;
    finishedAt?: number;
}

export interface DedupFocusRequest {
    scope: CharacterDedupScanScope;
    at: number;
}

export interface DedupToastGateInput {
    mounted: boolean;
    view: string;
    currentCharId?: string;
    taskCharIds: string[];
}

/** 去重完成后是否还要弹「点这里查看/确认」toast。
 *  用户正待在能看到该角色结果的地方（设置页 / 宫殿主页的结果提示条）时不需要弹；
 *  离开页面、切到别的角色、或 App 已卸载时，才需要 toast 把人叫回来。 */
export function shouldNotifyDedupCompletion({
    mounted,
    view,
    currentCharId,
    taskCharIds,
}: DedupToastGateInput): boolean {
    if (!mounted) return true;
    const ownerCharId = taskCharIds[0];
    if (!ownerCharId || currentCharId !== ownerCharId) return true;
    return view !== 'settings' && view !== 'palace';
}

const STORAGE_KEY = 'sullyos.memoryPalace.dedupTasks.v2';
const LEGACY_STORAGE_KEY = 'sullyos.memoryPalace.dedupTask.v1';

function scopeKeyFor(charIds: string[]): string {
    return [...charIds].sort().join('\u0000');
}

function scopeKeyForScope(scope: Pick<CharacterDedupScanScope, 'charIds'>): string {
    return scopeKeyFor(scope.charIds);
}

function makeEmptyTask(charIds: string[]): DedupTaskState {
    return {
        status: 'idle',
        mode: 'exact',
        scope: { charIds: [...charIds], scopeLabel: '', ownerName: '' },
        progress: null,
        result: null,
        preview: null,
        startedAt: 0,
        updatedAt: 0,
    };
}

function isUsableTask(value: unknown): value is DedupTaskState {
    if (!value || typeof value !== 'object') return false;
    const task = value as Partial<DedupTaskState>;
    return !!task.status && task.status !== 'idle' && Array.isArray(task.scope?.charIds);
}

function interruptPersistedTask(task: DedupTaskState): DedupTaskState {
    return {
        ...task,
        status: 'interrupted',
        result: '[warn]上次的去重任务因页面关闭而中断，请重新扫描',
        progress: null,
        updatedAt: Date.now(),
    };
}

function loadPersisted(): Record<string, DedupTaskState> {
    if (typeof localStorage === 'undefined') return {};
    const tasks: Record<string, DedupTaskState> = {};
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as Record<string, DedupTaskState>;
            for (const [key, value] of Object.entries(parsed)) {
                if (!isUsableTask(value)) continue;
                tasks[key] = value.status === 'running' ? interruptPersistedTask(value) : value;
            }
        }
    } catch {
        // 损坏的持久化数据直接忽略，回到空状态
    }
    if (Object.keys(tasks).length === 0) {
        try {
            const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
            if (legacyRaw) {
                const legacy = JSON.parse(legacyRaw) as DedupTaskState;
                if (isUsableTask(legacy)) {
                    tasks[scopeKeyFor(legacy.scope.charIds)] = legacy.status === 'running'
                        ? interruptPersistedTask(legacy)
                        : legacy;
                }
                localStorage.removeItem(LEGACY_STORAGE_KEY);
            }
        } catch {
            // 旧数据损坏时同样忽略
        }
    }
    return tasks;
}

let tasks: Record<string, DedupTaskState> = loadPersisted();
let focusRequest: DedupFocusRequest | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

function persist() {
    if (typeof localStorage === 'undefined') return;
    try {
        const entries = Object.entries(tasks).filter(([, task]) => task.status !== 'idle');
        if (entries.length === 0) {
            localStorage.removeItem(STORAGE_KEY);
        } else {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
        }
        localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
        // 配额 / 隐私模式：内存里照常工作，只是刷新后不保留
    }
}

export const dedupTaskStore = {
    getFor: (scope: Pick<CharacterDedupScanScope, 'charIds'>): DedupTaskState => {
        const key = scopeKeyForScope(scope);
        const existing = tasks[key];
        if (existing) return existing;
        const empty = makeEmptyTask(scope.charIds);
        tasks[key] = empty;
        return empty;
    },
    getForChar: (charId: string): DedupTaskState => dedupTaskStore.getFor({ charIds: [charId] }),
    setFor: (scope: Pick<CharacterDedupScanScope, 'charIds'>, patch: Partial<DedupTaskState>) => {
        const key = scopeKeyForScope(scope);
        const prev = tasks[key] ?? makeEmptyTask(scope.charIds);
        tasks[key] = { ...prev, ...patch, updatedAt: Date.now() };
        emit();
        persist();
    },
    setForChar: (charId: string, patch: Partial<DedupTaskState>) => {
        dedupTaskStore.setFor({ charIds: [charId] }, patch);
    },
    updateFor: (
        scope: Pick<CharacterDedupScanScope, 'charIds'>,
        updater: (prev: DedupTaskState) => DedupTaskState,
    ) => {
        const key = scopeKeyForScope(scope);
        const prev = tasks[key] ?? makeEmptyTask(scope.charIds);
        tasks[key] = { ...updater(prev), updatedAt: Date.now() };
        emit();
        persist();
    },
    updateForChar: (charId: string, updater: (prev: DedupTaskState) => DedupTaskState) => {
        dedupTaskStore.updateFor({ charIds: [charId] }, updater);
    },
    /** 开启一个新任务：只替换同一扫描范围的任务，其他角色的候选 / 结果原样保留 */
    begin: (init: { mode: DedupMode; scope: CharacterDedupScanScope; aiApiSource?: string; result: string }) => {
        const key = scopeKeyForScope(init.scope);
        tasks[key] = {
            ...makeEmptyTask(init.scope.charIds),
            status: 'running',
            mode: init.mode,
            scope: init.scope,
            aiApiSource: init.aiApiSource,
            result: init.result,
            startedAt: Date.now(),
            updatedAt: Date.now(),
        };
        emit();
        persist();
    },
    /** 请求打开记忆宫殿并跳到指定范围的去重结果（App 尚未挂载时也会在挂载后生效） */
    requestFocus: (scope: CharacterDedupScanScope) => {
        focusRequest = { scope, at: Date.now() };
        emit();
    },
    getFocusRequest: (): DedupFocusRequest | null => focusRequest,
    clearFocusRequest: () => {
        if (!focusRequest) return;
        focusRequest = null;
        emit();
    },
    resetFor: (scope: Pick<CharacterDedupScanScope, 'charIds'>) => {
        const key = scopeKeyForScope(scope);
        if (!tasks[key]) return;
        delete tasks[key];
        emit();
        persist();
    },
    resetForChar: (charId: string) => {
        dedupTaskStore.resetFor({ charIds: [charId] });
    },
    /** 清空所有任务（测试 / 全局维护用；日常清单个角色请用 resetForChar） */
    reset: () => {
        tasks = {};
        focusRequest = null;
        emit();
        persist();
    },
    subscribe: (l: () => void) => {
        listeners.add(l);
        return () => { listeners.delete(l); };
    },
};

export function useDedupTask(charIds: string[] = []): DedupTaskState {
    return useSyncExternalStore(
        dedupTaskStore.subscribe,
        () => dedupTaskStore.getFor({ charIds }),
        () => dedupTaskStore.getFor({ charIds }),
    );
}

export function useDedupFocusRequest(): DedupFocusRequest | null {
    return useSyncExternalStore(
        dedupTaskStore.subscribe,
        () => dedupTaskStore.getFocusRequest(),
        () => dedupTaskStore.getFocusRequest(),
    );
}
