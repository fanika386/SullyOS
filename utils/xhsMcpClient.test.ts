import { afterEach, describe, expect, it, vi } from 'vitest';
import { XhsMcpClient } from './xhsMcpClient';

describe('XhsMcpClient bridge mode', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('treats a 200 bridge payload with success:false as a failed tool result', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                success: false,
                msg: '小红书上游拒绝了这次搜索',
                feeds: [],
            }),
        }));

        const result = await XhsMcpClient.search('https://worker.example/api', '江晏');

        expect(result.success).toBe(false);
        expect(result.error).toContain('小红书上游拒绝了这次搜索');
    });
});
