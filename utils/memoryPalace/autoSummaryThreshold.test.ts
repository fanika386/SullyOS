import { beforeEach, describe, expect, it } from 'vitest';
import {
    DEFAULT_AUTO_SUMMARY_THRESHOLD,
    MAX_AUTO_SUMMARY_THRESHOLD,
    MIN_AUTO_SUMMARY_THRESHOLD,
    getAutoSummaryThresholdHint,
    getMemoryPalaceAutoSummaryThreshold,
    normalizeAutoSummaryThreshold,
} from './pipeline';

describe('记忆宫殿自动总结触发条数配置', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('没有保存配置时使用默认值', () => {
        expect(getMemoryPalaceAutoSummaryThreshold()).toBe(DEFAULT_AUTO_SUMMARY_THRESHOLD);
    });

    it('读取保存后的 autoSummaryThreshold', () => {
        localStorage.setItem('os_memory_palace_config', JSON.stringify({ autoSummaryThreshold: 250 }));
        expect(getMemoryPalaceAutoSummaryThreshold()).toBe(250);
    });

    it('支持输入字符串，并四舍五入到整数', () => {
        expect(normalizeAutoSummaryThreshold('80.7')).toBe(81);
    });

    it('小于最小值会钳制到下限', () => {
        localStorage.setItem('os_memory_palace_config', JSON.stringify({ autoSummaryThreshold: 1 }));
        expect(getMemoryPalaceAutoSummaryThreshold()).toBe(MIN_AUTO_SUMMARY_THRESHOLD);
    });

    it('大于最大值会钳制到上限', () => {
        localStorage.setItem('os_memory_palace_config', JSON.stringify({ autoSummaryThreshold: 9999 }));
        expect(getMemoryPalaceAutoSummaryThreshold()).toBe(MAX_AUTO_SUMMARY_THRESHOLD);
    });

    it('配置损坏或字段非法时回退默认值', () => {
        localStorage.setItem('os_memory_palace_config', JSON.stringify({ autoSummaryThreshold: 'abc' }));
        expect(getMemoryPalaceAutoSummaryThreshold()).toBe(DEFAULT_AUTO_SUMMARY_THRESHOLD);

        localStorage.setItem('os_memory_palace_config', '{broken');
        expect(getMemoryPalaceAutoSummaryThreshold()).toBe(DEFAULT_AUTO_SUMMARY_THRESHOLD);
    });

    it('小阈值提示更新更快和重复风险', () => {
        const hint = getAutoSummaryThresholdHint(MIN_AUTO_SUMMARY_THRESHOLD);
        expect(hint).toContain('触发更快');
        expect(hint).toContain('重复');
    });

    it('中等阈值提示相对均衡', () => {
        expect(getAutoSummaryThresholdHint(300)).toContain('均衡');
    });

    it('大阈值提示更省调用和更长上下文', () => {
        const hint = getAutoSummaryThresholdHint(MAX_AUTO_SUMMARY_THRESHOLD);
        expect(hint).toContain('更省');
        expect(hint).toContain('完整');
    });
});
