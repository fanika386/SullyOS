import React, { useRef, useState } from 'react';
import { useOS } from '../../context/OSContext';
import type { WorldbookSkin } from '../../types';
import { shareOrDownloadFile } from '../../utils/shareExport';

const SkinSwatch: React.FC<{ skin: WorldbookSkin }> = ({ skin }) => {
    const t = skin.tokens;
    return (
        <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg border border-slate-200 overflow-hidden relative shrink-0" style={{ background: t.canvas }}>
                <div className="absolute left-1 right-1 top-1 bottom-1 rounded border" style={{ background: t.surface, borderColor: t.border }} />
                <div className="absolute left-2.5 top-2.5 w-2 h-2 rounded-full" style={{ background: t.primary }} />
            </div>
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                    <span className="w-4 h-2 rounded-sm" style={{ background: t.primary }} />
                    <span className="w-4 h-2 rounded-sm border" style={{ borderColor: t.border, background: t.surfaceAlt }} />
                </div>
                <span className="text-[9px] text-slate-400">圆角 {t.radiusCard}px · {t.fontHeading === 'serif' ? '衬线标题' : '无衬线标题'}</span>
            </div>
        </div>
    );
};

export const WorldbookSkinManager: React.FC = () => {
    const {
        worldbookSkins,
        activeWorldbookSkinId,
        saveWorldbookSkin,
        applyWorldbookSkin,
        deleteWorldbookSkin,
        renameWorldbookSkin,
        exportWorldbookSkin,
        importWorldbookSkin,
        addToast,
    } = useOS();
    const [newName, setNewName] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const importRef = useRef<HTMLInputElement>(null);

    const handleSave = async () => {
        if (!newName.trim()) {
            addToast('请输入皮肤名称', 'error');
            return;
        }
        await saveWorldbookSkin(newName);
        setNewName('');
    };

    const handleExport = async (skin: WorldbookSkin) => {
        try {
            const blob = await exportWorldbookSkin(skin.id);
            const safeName = skin.name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim() || 'worldbook_skin';
            const result = await shareOrDownloadFile({
                content: await blob.text(),
                fileName: `${safeName}.json`,
                mimeType: 'application/json;charset=utf-8',
                shareTitle: `导出世界书皮肤「${skin.name}」`,
            });
            addToast(result === 'shared' ? '已调起分享' : '世界书皮肤已导出', 'success');
        } catch (e: any) {
            addToast(e?.message || '导出失败', 'error');
        }
    };

    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            await importWorldbookSkin(file);
        } catch (e: any) {
            addToast(e?.message || '导入失败', 'error');
        } finally {
            if (importRef.current) importRef.current.value = '';
        }
    };

    const handleRename = async (id: string) => {
        if (!editName.trim()) {
            addToast('名称不能为空', 'error');
            return;
        }
        await renameWorldbookSkin(id, editName);
        setEditingId(null);
        setEditName('');
    };

    return (
        <div className="space-y-6">
            <section className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">世界书皮肤</h2>
                <p className="text-[10px] text-slate-400 mb-4">
                    管理世界书 App 的界面皮肤（颜色 / 圆角 / 标题字体）。切换即时生效，世界书数据不受影响。
                </p>
                <div className="flex gap-2">
                    <input
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                        placeholder="基于当前皮肤另存为…"
                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:bg-white focus:border-indigo-300 transition-all"
                    />
                    <button onClick={handleSave} className="px-4 py-2 bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-transform">保存为新皮肤</button>
                </div>
            </section>

            <section className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">已保存皮肤 ({worldbookSkins.length})</h2>
                    <button onClick={() => importRef.current?.click()} className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-100">导入皮肤文件</button>
                    <input ref={importRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImport} />
                </div>
                <div className="space-y-3">
                    {worldbookSkins.map(skin => {
                        const active = skin.id === activeWorldbookSkinId;
                        return (
                            <div key={skin.id} className={`rounded-2xl border p-4 transition-colors ${active ? 'border-indigo-300 bg-indigo-50/40' : 'border-slate-100 bg-slate-50/50'}`}>
                                <div className="flex items-start justify-between gap-3">
                                    <SkinSwatch skin={skin} />
                                    <div className="text-right shrink-0">
                                        {editingId === skin.id ? (
                                            <div className="flex gap-1.5">
                                                <input
                                                    value={editName}
                                                    onChange={e => setEditName(e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter') handleRename(skin.id); }}
                                                    className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs w-24 outline-none"
                                                />
                                                <button onClick={() => handleRename(skin.id)} className="px-2 py-1 bg-indigo-500 text-white rounded-lg text-[10px] font-bold">确定</button>
                                            </div>
                                        ) : (
                                            <div className="text-xs font-bold text-slate-700">{skin.name} {skin.isBuiltin && <span className="text-[9px] text-slate-400 font-normal">内置</span>}</div>
                                        )}
                                        <div className="text-[9px] text-slate-400 mt-0.5">{active ? '使用中' : new Date(skin.createdAt).toLocaleDateString('zh-CN')}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 mt-3">
                                    <button onClick={() => applyWorldbookSkin(skin.id)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold active:scale-95 transition-transform ${active ? 'bg-indigo-100 text-indigo-400' : 'bg-indigo-500 text-white'}`}>
                                        {active ? '使用中' : '应用'}
                                    </button>
                                    <button onClick={() => { setEditingId(skin.id); setEditName(skin.name); }} className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-white border border-slate-200 text-slate-600">重命名</button>
                                    <button onClick={() => handleExport(skin)} className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-white border border-slate-200 text-slate-600">导出</button>
                                    {!skin.isBuiltin && (
                                        confirmDeleteId === skin.id ? (
                                            <>
                                                <button onClick={() => deleteWorldbookSkin(skin.id)} className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-red-500 text-white">确认</button>
                                                <button onClick={() => setConfirmDeleteId(null)} className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-white border border-slate-200 text-slate-600">取消</button>
                                            </>
                                        ) : (
                                            <button onClick={() => setConfirmDeleteId(skin.id)} className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-white border border-slate-200 text-slate-400">删除</button>
                                        )
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>
        </div>
    );
};
