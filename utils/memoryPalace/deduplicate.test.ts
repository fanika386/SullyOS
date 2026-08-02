import { describe, expect, it } from 'vitest';
import { EventBoxDB, MemoryLinkDB, MemoryNodeDB, MemoryVectorDB } from './db';
import {
    applyExactDuplicateMemoryDeletion,
    findExactDuplicateMemoryGroups,
    scanSemanticDuplicateMemories,
} from './deduplicate';
import type { EventBox, MemoryLink, MemoryNode, MemoryVector } from './types';

function makeNode(id: string, charId: string, over: Partial<MemoryNode> = {}): MemoryNode {
    return {
        id,
        charId,
        content: `记忆 ${id}`,
        room: 'living_room',
        tags: [],
        importance: 5,
        mood: 'peaceful',
        embedded: false,
        createdAt: 1000,
        lastAccessedAt: 1000,
        accessCount: 0,
        ...over,
    };
}

describe('记忆宫殿全局精确去重', () => {
    it('只把同一角色内正文完全相同的记忆归为重复', () => {
        const nodes = [
            makeNode('dedup_preview_a1', 'dedup_char_a', { content: 'TA 说喜欢雨天。', createdAt: 1000 }),
            makeNode('dedup_preview_a2', 'dedup_char_a', { content: 'TA 说喜欢雨天。', createdAt: 2000 }),
            makeNode('dedup_preview_a3', 'dedup_char_a', { content: 'TA 说喜欢晴天。', createdAt: 3000 }),
            makeNode('dedup_preview_b1', 'dedup_char_b', { content: 'TA 说喜欢雨天。', createdAt: 4000 }),
        ];

        const preview = findExactDuplicateMemoryGroups(nodes);

        expect(preview.scannedCount).toBe(4);
        expect(preview.groups).toHaveLength(1);
        expect(preview.duplicateCount).toBe(1);
        expect(preview.groups[0].keep.id).toBe('dedup_preview_a1');
        expect(preview.groups[0].duplicates.map(n => n.id)).toEqual(['dedup_preview_a2']);
    });

    it('删除重复项时同步清理向量、关联和事件盒成员引用', async () => {
        const charId = 'dedup_char_delete';
        const keep = makeNode('dedup_delete_keep', charId, {
            content: 'TA 把一枚贝壳放进抽屉。',
            embedded: true,
            createdAt: 1000,
        });
        const duplicate = makeNode('dedup_delete_dup', charId, {
            content: 'TA 把一枚贝壳放进抽屉。',
            embedded: true,
            eventBoxId: 'dedup_delete_box',
            createdAt: 2000,
        });
        const other = makeNode('dedup_delete_other', charId, {
            content: '另一条不同的记忆。',
            eventBoxId: 'dedup_delete_box',
            createdAt: 3000,
        });
        await MemoryNodeDB.saveMany([keep, duplicate, other]);

        const vectors: MemoryVector[] = [keep, duplicate].map(node => ({
            memoryId: node.id,
            charId,
            vector: new Float32Array([1, 0, 0, 0]),
            dimensions: 4,
            model: 'test',
        }));
        await MemoryVectorDB.saveMany(vectors);

        const link: MemoryLink = {
            id: 'dedup_delete_link',
            sourceId: duplicate.id,
            targetId: other.id,
            type: 'temporal',
            strength: 0.4,
        };
        await MemoryLinkDB.save(link);

        const box: EventBox = {
            id: 'dedup_delete_box',
            charId,
            name: '抽屉里的贝壳',
            tags: [],
            summaryNodeId: null,
            liveMemoryIds: [duplicate.id, other.id],
            archivedMemoryIds: [],
            compressionCount: 0,
            createdAt: 1000,
            updatedAt: 1000,
            lastCompressedAt: null,
        };
        await EventBoxDB.save(box);

        const preview = findExactDuplicateMemoryGroups(await MemoryNodeDB.getAll());
        const result = await applyExactDuplicateMemoryDeletion(preview);

        expect(result.deleted).toBe(1);
        expect(result.failed).toEqual([]);
        expect(await MemoryNodeDB.getById(keep.id)).toBeTruthy();
        expect(await MemoryNodeDB.getById(duplicate.id)).toBeUndefined();
        expect(await MemoryVectorDB.getByMemoryId(keep.id)).toBeTruthy();
        expect(await MemoryVectorDB.getByMemoryId(duplicate.id)).toBeUndefined();
        expect(await MemoryLinkDB.getByNodeId(duplicate.id)).toEqual([]);
        const updatedBox = await EventBoxDB.getById(box.id);
        expect(updatedBox?.liveMemoryIds).toEqual([other.id]);
    });

    it('近似语义扫描按角色范围找高相似向量，不跨角色误并', async () => {
        const targetChar = 'dedup_semantic_target';
        const otherChar = 'dedup_semantic_other';
        const targetA = makeNode('dedup_semantic_a', targetChar, {
            content: 'TA 说以后想在雨天一起去海边散步。',
            embedded: true,
            createdAt: 1000,
        });
        const targetB = makeNode('dedup_semantic_b', targetChar, {
            content: 'TA 提到将来希望下雨的时候和我去海边走走。',
            embedded: true,
            createdAt: 2000,
        });
        const targetC = makeNode('dedup_semantic_c', targetChar, {
            content: 'TA 今天讨论了考试复习计划。',
            embedded: true,
            createdAt: 3000,
        });
        const otherSameMeaning = makeNode('dedup_semantic_other_same', otherChar, {
            content: 'TA 提到将来希望下雨的时候和我去海边走走。',
            embedded: true,
            createdAt: 4000,
        });
        await MemoryNodeDB.saveMany([targetA, targetB, targetC, otherSameMeaning]);

        const vectors: MemoryVector[] = [
            { memoryId: targetA.id, charId: targetChar, vector: new Float32Array([1, 0, 0]), dimensions: 3, model: 'test' },
            { memoryId: targetB.id, charId: targetChar, vector: new Float32Array([0.99, 0.01, 0]), dimensions: 3, model: 'test' },
            { memoryId: targetC.id, charId: targetChar, vector: new Float32Array([0, 1, 0]), dimensions: 3, model: 'test' },
            { memoryId: otherSameMeaning.id, charId: otherChar, vector: new Float32Array([0.99, 0.01, 0]), dimensions: 3, model: 'test' },
        ];
        await MemoryVectorDB.saveMany(vectors);

        const preview = await scanSemanticDuplicateMemories({
            charIds: [targetChar],
            threshold: 0.95,
        });

        expect(preview.scannedCount).toBe(3);
        expect(preview.vectorizedCount).toBe(3);
        expect(preview.charCount).toBe(1);
        expect(preview.groups).toHaveLength(1);
        expect(preview.duplicateCount).toBe(1);
        expect(preview.groups[0].keep.id).toBe(targetA.id);
        expect(preview.groups[0].duplicates.map(n => n.id)).toEqual([targetB.id]);
        expect(preview.groups[0].maxSimilarity).toBeGreaterThanOrEqual(0.99);
    });
});
