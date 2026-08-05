import { describe, expect, it } from 'vitest';
import { dedupTaskStore, shouldNotifyDedupCompletion } from './dedupTaskStore';

function scopeFor(charId: string, name: string) {
    return { charIds: [charId], scopeLabel: `【${name}】`, ownerName: name };
}

describe('记忆宫殿去重全局任务状态的角色归属', () => {
    it('begin 后任务归属固定在发起角色，后续 set/update 不会改变归属', () => {
        dedupTaskStore.reset();
        dedupTaskStore.begin({
            mode: 'exact',
            scope: scopeFor('char_a', 'A'),
            result: '开始扫描 A…',
        });
        dedupTaskStore.set({ status: 'error', result: '[err]测试报错' });
        dedupTaskStore.update(prev => ({ ...prev, progress: null }));

        const state = dedupTaskStore.get();
        expect(state.scope.charIds).toEqual(['char_a']);
        expect(state.scope.ownerName).toBe('A');
        expect(state.status).toBe('error');
        expect(state.result).toBe('[err]测试报错');

        dedupTaskStore.reset();
    });

    it('新任务会整体替换成新的角色归属，不残留旧角色的候选或结果', () => {
        dedupTaskStore.reset();
        dedupTaskStore.begin({
            mode: 'ai',
            scope: scopeFor('char_a', 'A'),
            aiApiSource: 'memoryPalace',
            result: '正在扫描 A…',
        });
        dedupTaskStore.set({ status: 'review', preview: { scannedCount: 1, charCount: 1, groups: [], duplicateCount: 0 } });

        dedupTaskStore.begin({
            mode: 'semantic',
            scope: scopeFor('char_b', 'B'),
            result: '正在扫描 B…',
        });

        const state = dedupTaskStore.get();
        expect(state.scope.charIds).toEqual(['char_b']);
        expect(state.mode).toBe('semantic');
        expect(state.preview).toBeNull();
        expect(state.result).toBe('正在扫描 B…');

        dedupTaskStore.reset();
    });
});

describe('去重完成 toast 的触发时机', () => {
    const base = {
        mounted: true,
        view: 'settings',
        currentCharId: 'char_a',
        taskCharIds: ['char_a'],
    };

    it('用户还待在当前角色的设置页或宫殿主页时，不弹“点这里查看”', () => {
        expect(shouldNotifyDedupCompletion({ ...base, view: 'settings' })).toBe(false);
        expect(shouldNotifyDedupCompletion({ ...base, view: 'palace' })).toBe(false);
    });

    it('用户离开当前页面（其他视图 / 其他角色 / App 卸载）时，才弹提醒', () => {
        expect(shouldNotifyDedupCompletion({ ...base, view: 'all' })).toBe(true);
        expect(shouldNotifyDedupCompletion({ ...base, view: 'picker' })).toBe(true);
        expect(shouldNotifyDedupCompletion({ ...base, currentCharId: 'char_b' })).toBe(true);
        expect(shouldNotifyDedupCompletion({ ...base, taskCharIds: ['char_b'] })).toBe(true);
        expect(shouldNotifyDedupCompletion({ ...base, mounted: false })).toBe(true);
    });
});
