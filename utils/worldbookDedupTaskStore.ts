/**
 * 全局「世界书 AI 深度检查任务」状态。
 *
 * 放在模块作用域而非 WorldbookApp 内部，这样：
 *   1. AI 深度检查启动后，即使退出世界书 App（甚至切到别的 OS App），任务照常跑；
 *   2. 再点回世界书时，可以直接读回选择 / 分析 / 结果，不会因为组件卸载而丢；
 *   3. 状态会持久化到 localStorage，整页刷新后也能看到上次的结果（或中断提示）。
 */
import { useSyncExternalStore } from 'react';
import type { WorldbookDuplicateAiResult, WorldbookDuplicateAnalysis } from './worldbook';

export type WorldbookDedupTaskStatus =
    | 'idle'        // 无任务
    | 'running'     // AI 深度检查中
    | 'done'        // 已完成
    | 'error'       // 失败
    | 'interrupted'; // 上次任务因整页关闭而中断

export interface WorldbookDedupTaskState {
    status: WorldbookDedupTaskStatus;
    /** 发起任务时选中的世界书 id 快照，回来时恢复选择 */
    selectedBookIds: string[];
    /** 发起任务时的本地分析快照，回来时可直接展示候选 / 结果 */
    analysis: WorldbookDuplicateAnalysis | null;
    /** AI 深度检查结果（done 时才有） */
    aiResult: WorldbookDuplicateAiResult | null;
    /** 发起任务时选的 API 来源，回来时恢复下拉 */
    aiChoiceId: string;
    progress: { label: string } | null;
    result: string | null;
    startedAt: number;
    updatedAt: number;
    finishedAt?: number;
    /** 用户点了完成 toast / 查看按钮，请求回到世界书并跳到去重面板；由组件消费后清掉 */
    focusRequestAt?: number;
}

const STORAGE_KEY = 'sullyos.worldbook.dedupTask.v1';

const emptyTask = (): WorldbookDedupTaskState => ({
    status: 'idle',
    selectedBookIds: [],
    analysis: null,
    aiResult: null,
    aiChoiceId: '',
    progress: null,
    result: null,
    startedAt: 0,
    updatedAt: 0,
});

function loadPersisted(): WorldbookDedupTaskState {
    if (typeof localStorage === 'undefined') return emptyTask();
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return emptyTask();
        const parsed = JSON.parse(raw) as WorldbookDedupTaskState;
        if (!parsed || parsed.status === 'idle') return emptyTask();
        // 全新页面加载时，如果上次任务还显示 running，它其实已经随旧页面一起终止了。
        // 内存里的任务不受影响（组件卸载不会触发这里），只有整页刷新才会走到这。
        if (parsed.status === 'running') {
            return {
                ...parsed,
                status: 'interrupted',
                result: '[warn]上次的 AI 深度检查因页面关闭而中断，请重新扫描',
                progress: null,
                updatedAt: Date.now(),
            };
        }
        return parsed;
    } catch {
        return emptyTask();
    }
}

let state: WorldbookDedupTaskState = loadPersisted();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());

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

export const worldbookDedupTaskStore = {
    get: (): WorldbookDedupTaskState => state,
    set: (patch: Partial<WorldbookDedupTaskState>) => {
        state = { ...state, ...patch, updatedAt: Date.now() };
        emit();
        persist();
    },
    /** 以当前状态为基准做局部更新（例如消费 focusRequestAt） */
    update: (updater: (prev: WorldbookDedupTaskState) => WorldbookDedupTaskState) => {
        state = { ...updater(state), updatedAt: Date.now() };
        emit();
        persist();
    },
    /** 开启一个新任务：清掉上一次的候选 / 结果，重置为 running */
    begin: (init: {
        selectedBookIds: string[];
        analysis: WorldbookDuplicateAnalysis | null;
        aiChoiceId: string;
        result: string;
    }) => {
        state = {
            ...emptyTask(),
            status: 'running',
            selectedBookIds: init.selectedBookIds,
            analysis: init.analysis,
            aiChoiceId: init.aiChoiceId,
            progress: { label: '正在读取选中的世界书正文并请求 AI…' },
            result: init.result,
            startedAt: Date.now(),
            updatedAt: Date.now(),
        };
        emit();
        persist();
    },
    /** 请求把用户带回世界书去重面板（配合可点击的完成 toast） */
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
    subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    },
};

export function useWorldbookDedupTask(): WorldbookDedupTaskState {
    return useSyncExternalStore(
        worldbookDedupTaskStore.subscribe,
        worldbookDedupTaskStore.get,
        worldbookDedupTaskStore.get,
    );
}
