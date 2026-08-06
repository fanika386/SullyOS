import { describe, expect, it } from 'vitest';
import { entityOverlapBonus, extractEntities } from './entities';

describe('轻量实体抽取', () => {
    it('抽取引号包裹的短语作为实体', () => {
        const entities = extractEntities('她说「想去海边」，还提到“SullyOS 发布会”值得期待');

        expect(entities).toContain('想去海边');
        expect(entities).toContain('SullyOS 发布会');
    });

    it('抽取拉丁字母/数字词并统一小写、去重', () => {
        const entities = extractEntities('TA 提到 OpenAI 和 openai 以及 iPhone 15 很好用');

        expect(entities).toContain('openai');
        expect(entities).toContain('iphone');
        expect(entities.filter(e => e === 'openai')).toHaveLength(1);
    });

    it('过滤 TA 这类常见短词，避免人人共享的实体刷分', () => {
        const entities = extractEntities('TA 说 OK 之后就出发');

        expect(entities).not.toContain('ta');
        expect(entities).not.toContain('ok');
    });

    it('已知词（如记忆标签）出现时也作为实体', () => {
        const entities = extractEntities('TA 喜欢雨天去海边散步', ['海边', '雨天']);

        expect(entities).toContain('海边');
        expect(entities).toContain('雨天');
    });
});

describe('实体重叠加成', () => {
    it('没有任何共享实体时加成为 0', () => {
        expect(entityOverlapBonus(['张三', '海边'], ['李四', '考试'])).toBe(0);
    });

    it('每共享一个实体加成 0.25，封顶 1', () => {
        expect(entityOverlapBonus(['张三'], ['张三', '海边'])).toBe(0.25);
        expect(entityOverlapBonus(['a', 'b', 'c', 'd', 'e'], ['a', 'b', 'c', 'd', 'e'])).toBe(1);
    });

    it('查询或记忆没有实体时加成为 0', () => {
        expect(entityOverlapBonus([], ['张三'])).toBe(0);
        expect(entityOverlapBonus(['张三'], [])).toBe(0);
    });
});
