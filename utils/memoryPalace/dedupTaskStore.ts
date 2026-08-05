/**
 * 全局「记忆宫殿去重任务」状态。
 *
 * 放在模块作用域而非 MemoryPalaceApp 内部，这样：
 *   1. 扫描 / 删除过程中即使退出记忆宫殿 App（甚至切到别的 OS App），任务照常跑；
 *   2. 再点回记忆宫殿时，可以直接读回进度 / 候选 / 结果，不会因为组件卸载而丢；
 *   3. 状态会持久化到 localStorage，整页刷新后也能看到上次的结果（或中断提示）。
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
    /** 用户点了完成 toast，请求打开记忆宫殿并跳到去重结果；由组件消费后清掉 */
    focusRequestAt?: number;
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

const STORAGE_KEY = 'sullyos.memoryPalace.dedupTask.v1';

const emptyTask = (): DedupTaskState => ({
    status: 'idle',
    mode: 'exact',
    scope: { charIds: [], scopeLabel: '', ownerName: '' },
    progress: null,
    result: null,
    preview: null,
    startedAt: 0,
    updatedAt: 0,
});

function loadPersisted(): DedupTaskState {
    if (typeof localStorage === 'undefined') return emptyTask();
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return emptyTask();
        const parsed = JSON.parse(raw) as DedupTaskState;
        if (!parsed || parsed.status === 'idle') return emptyTask();
        // 全新页面加载时，如果上次任务还显示 running，它其实已经随旧页面一起终止了。
        // 内存里的任务不受影响（组件卸载不会触发这里），只有整页刷新才会走到这。
        if (parsed.status === 'running') {
            return {
                ...parsed,
                status: 'interrupted',
                result: '[warn]上次的去重任务因页面关闭而中断，请重新扫描',
                progress: null,
                updatedAt: Date.now(),
            };
        }
        return parsed;
    } catch {
        return emptyTask();
    }
}

let state: DedupTaskState = loadPersisted();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

function persist() {
    if (typeof localStorage === 'undefined') return;
    try {
        if (state.status === 'idle') {
            localStorage.removeItem(STORAGE_KEY);
        } else {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        }
    } catch {
        // 配额 / 隐私模式：内存里照常工作，只是刷新后不保留
    }
}

export const dedupTaskStore = {
    get: (): DedupTaskState => state,
    set: (patch: Partial<DedupTaskState>) => {
        state = { ...state, ...patch, updatedAt: Date.now() };
        emit();
        persist();
    },
    /** 以当前状态为基准做局部更新（例如进度里的 step 字段） */
    update: (updater: (prev: DedupTaskState) => DedupTaskState) => {
        state = { ...updater(state), updatedAt: Date.now() };
        emit();
        persist();
    },
    /** 开启一个新任务：清掉上一次的候选 / 结果，重置为 running */
    begin: (init: { mode: DedupMode; scope: CharacterDedupScanScope; aiApiSource?: string; result: string }) => {
        state = {
            ...emptyTask(),
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
    /** 请求把用户带回记忆宫殿去重结果（配合可点击的完成 toast） */
    requestFocus: () => {
        state = { ...state, focusRequestAt: Date.now(), updatedAt: Date.now() };
        emit();
        persist();
    },
    reset: () => {
        state = emptyTask();
        emit();
        persist();
    },
    subscribe: (l: () => void) => {
        listeners.add(l);
        return () => { listeners.delete(l); };
    },
};

export function useDedupTask(): DedupTaskState {
    return useSyncExternalStore(dedupTaskStore.subscribe, dedupTaskStore.get, dedupTaskStore.get);
}
