import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runXhsDetail, type AgenticToolCtx, type XhsCaches } from './agenticTools';
import { XhsMcpClient } from './xhsMcpClient';

vi.mock('./xhsMcpClient', async () => {
    const actual = await vi.importActual<typeof import('./xhsMcpClient')>('./xhsMcpClient');
    return {
        ...actual,
        XhsMcpClient: {
            ...actual.XhsMcpClient,
            getNoteDetail: vi.fn(),
            search: vi.fn(),
        },
    };
});

const makeCtx = (notes: any[] = []): AgenticToolCtx => {
    const xhsCaches: XhsCaches = {
        xsecTokenCache: new Map(notes.map(n => [n.noteId, n.xsecToken]).filter(([, v]) => !!v) as [string, string][]),
        noteTitleCache: new Map(notes.map(n => [n.noteId, n.title]).filter(([, v]) => !!v) as [string, string][]),
        xsecSourceCache: new Map(notes.map(n => [n.noteId, n.xsecSource]).filter(([, v]) => !!v) as [string, string][]),
        commentUserIdCache: new Map(),
        commentAuthorNameCache: new Map(),
        commentParentIdCache: new Map(),
    };
    return {
        char: { id: 'char-1', name: '测试角色', xhsEnabled: true } as any,
        userProfile: { name: '我' } as any,
        realtimeConfig: {
            xhsMcpConfig: {
                enabled: true,
                serverUrl: 'https://worker.example/api',
            },
        } as any,
        xhsCaches,
        lastXhsNotesRef: { current: notes },
    };
};

describe('runXhsDetail', () => {
    beforeEach(() => {
        vi.mocked(XhsMcpClient.getNoteDetail).mockReset();
        vi.mocked(XhsMcpClient.search).mockReset();
        vi.mocked(XhsMcpClient.search).mockResolvedValue({ success: false, error: 'no refreshed token' });
    });

    it('marks a successful but blank XHS detail payload as failed', async () => {
        vi.mocked(XhsMcpClient.getNoteDetail).mockResolvedValue({
            success: true,
            data: {
                success: true,
                data: {
                    note: { note_id: 'note-1', title: '', content: '', desc: '' },
                    comments: { list: [] },
                },
            },
        });

        const result = await runXhsDetail(
            { noteId: 'note-1' },
            makeCtx([{ noteId: 'note-1', title: '缓存标题', xsecToken: 'token-1' }]),
        );

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.failed).toBe(true);
            expect(result.detailText).toContain('小红书返回了空详情');
        }
    });

    it('passes xsec_source from the cached search note to get-feed-detail', async () => {
        vi.mocked(XhsMcpClient.getNoteDetail).mockResolvedValue({
            success: true,
            data: {
                data: {
                    note: {
                        note_id: 'note-2',
                        title: '标题',
                        content: '正文',
                        desc: '正文',
                        xsec_token: 'token-2',
                    },
                    comments: { list: [] },
                },
            },
        });

        await runXhsDetail(
            { noteId: 'note-2' },
            makeCtx([{ noteId: 'note-2', title: '标题', xsecToken: 'token-2', xsecSource: 'pc_search' }]),
        );

        expect(XhsMcpClient.getNoteDetail).toHaveBeenCalledWith(
            'https://worker.example/api',
            'note-2',
            'token-2',
            expect.objectContaining({ loadAllComments: true, xsecSource: 'pc_search' }),
        );
    });
});
