
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOS } from '../context/OSContext';
import { processImage } from '../utils/file';
import LifeRecordPanel from '../components/lifeRecord/LifeRecordPanel';
import { DEFAULT_USER_PROFILE_ID } from '../utils/userProfiles';

const UserApp: React.FC = () => {
    const {
        closeApp,
        addToast,
        characters,
        userProfile,
        userProfiles,
        characterUserProfileBindings,
        createUserProfile,
        updateUserProfileById,
        deleteUserProfile,
        bindUserProfileToCharacter,
    } = useOS();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [tab, setTab] = useState<'profile' | 'life'>('profile');
    const [selectedProfileId, setSelectedProfileId] = useState(DEFAULT_USER_PROFILE_ID);

    const selectedProfile = useMemo(() => {
        return userProfiles.find(profile => profile.id === selectedProfileId)
            || userProfiles.find(profile => profile.id === DEFAULT_USER_PROFILE_ID)
            || userProfile;
    }, [selectedProfileId, userProfile, userProfiles]);

    useEffect(() => {
        if (userProfiles.some(profile => profile.id === selectedProfileId)) return;
        setSelectedProfileId(DEFAULT_USER_PROFILE_ID);
    }, [selectedProfileId, userProfiles]);

    const updateSelectedProfile = (updates: Parameters<typeof updateUserProfileById>[1]) => {
        updateUserProfileById(selectedProfile.id || DEFAULT_USER_PROFILE_ID, updates);
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const base64 = await processImage(file);
            updateSelectedProfile({ avatar: base64 });
            addToast('头像已更新', 'success');
        } catch (err: any) {
            addToast(err.message, 'error');
        }
    };

    const handleCreateProfile = async () => {
        const profile = await createUserProfile({
            name: `新面具 ${userProfiles.length + 1}`,
            avatar: selectedProfile.avatar || userProfile.avatar,
            bio: '',
        });
        setSelectedProfileId(profile.id || DEFAULT_USER_PROFILE_ID);
        addToast('已新建面具', 'success');
    };

    const handleDeleteSelectedProfile = () => {
        if (selectedProfile.id === DEFAULT_USER_PROFILE_ID) {
            addToast('默认面具不能删除', 'info');
            return;
        }
        const ok = window.confirm(`删除面具「${selectedProfile.name || '未命名'}」？`);
        if (!ok) return;
        deleteUserProfile(selectedProfile.id || DEFAULT_USER_PROFILE_ID);
        setSelectedProfileId(DEFAULT_USER_PROFILE_ID);
        addToast('已删除面具', 'success');
    };

    return (
        <div className="h-full w-full bg-slate-50 flex flex-col animate-fade-in">
            <div className="bg-white/70 backdrop-blur-md border-b border-slate-100 shrink-0 sticky top-0 z-10" style={{ paddingTop: 'var(--safe-top)' }}>
                <div className="flex items-center px-4 py-3 gap-2">
                    <button onClick={closeApp} className="p-2 -ml-2 rounded-full hover:bg-black/5 active:scale-90 transition-transform">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-6 h-6 text-slate-600">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                        </svg>
                    </button>
                    <h1 className="text-lg font-bold text-slate-700 tracking-wide">个人档案</h1>
                </div>
                <div className="flex gap-1.5 px-4 pb-2.5">
                    {([['profile', '我的档案'], ['life', '生活记录']] as const).map(([key, label]) => (
                        <button
                            key={key}
                            onClick={() => setTab(key)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
                                tab === key ? 'bg-primary text-white shadow-sm' : 'bg-slate-100 text-slate-400'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-10 pt-5 space-y-5">
                {tab === 'life' && <LifeRecordPanel />}
                {tab === 'profile' && <>
                    <div className="bg-white rounded-[1.75rem] shadow-[0_10px_30px_-12px_rgba(80,70,120,0.18)] border border-slate-100 p-4">
                        <div className="flex items-center justify-between gap-3 mb-3">
                            <div>
                                <h2 className="text-sm font-black text-slate-700">身份面具</h2>
                                <p className="text-[10px] text-slate-400 mt-0.5">选择一个面具编辑，下面可绑定到角色。</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleCreateProfile}
                                    className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center active:scale-95 transition-transform shadow-sm"
                                    aria-label="新建面具"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                                    </svg>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDeleteSelectedProfile}
                                    disabled={selectedProfile.id === DEFAULT_USER_PROFILE_ID}
                                    className="w-9 h-9 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40 disabled:active:scale-100"
                                    aria-label="删除当前面具"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5.75A1.75 1.75 0 0 1 10.75 4h2.5A1.75 1.75 0 0 1 15 5.75V7m-7.25 3 .55 8.25A1.75 1.75 0 0 0 10.05 20h3.9a1.75 1.75 0 0 0 1.75-1.75L16.25 10" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                            {userProfiles.map(profile => (
                                <button
                                    key={profile.id}
                                    type="button"
                                    onClick={() => setSelectedProfileId(profile.id || DEFAULT_USER_PROFILE_ID)}
                                    className={`shrink-0 min-w-[132px] max-w-[190px] rounded-2xl border px-3 py-2 text-left transition-all ${
                                        profile.id === selectedProfile.id
                                            ? 'border-primary/40 bg-primary/5 shadow-sm'
                                            : 'border-slate-100 bg-slate-50/80'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <img src={profile.avatar || userProfile.avatar} className="w-8 h-8 rounded-full object-cover bg-slate-100 shrink-0" alt="" />
                                        <div className="min-w-0">
                                            <div className="text-xs font-black text-slate-700 truncate">{profile.name || profile.label || '未命名'}</div>
                                            <div className="text-[10px] text-slate-400 truncate">{profile.id === DEFAULT_USER_PROFILE_ID ? '默认' : (profile.bio || '空白设定')}</div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-[1.75rem] shadow-[0_10px_30px_-12px_rgba(80,70,120,0.25)] border border-slate-100 overflow-hidden">
                        <div className="relative h-24" style={{ background: 'linear-gradient(135deg, hsl(var(--primary-hue),var(--primary-sat),72%) 0%, hsl(var(--primary-hue),var(--primary-sat),60%) 100%)' }}>
                            <div className="absolute -top-6 -right-4 w-28 h-28 rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }} />
                            <div className="absolute top-6 left-6 w-16 h-16 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
                        </div>

                        <div className="px-6 pb-6 -mt-12">
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="relative w-24 h-24 rounded-full cursor-pointer group mx-auto"
                            >
                                <div className="w-full h-full rounded-full ring-4 ring-white bg-slate-100 overflow-hidden shadow-md">
                                    <img src={selectedProfile.avatar || userProfile.avatar} className="w-full h-full object-cover group-hover:opacity-80 transition-opacity" />
                                </div>
                                <div className="absolute bottom-0.5 right-0.5 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center ring-2 ring-white shadow-sm">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                                    </svg>
                                </div>
                            </div>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
                            <p className="mt-2 text-center text-[10px] text-slate-400">{selectedProfile.id === DEFAULT_USER_PROFILE_ID ? '默认面具' : '自定义面具'}</p>

                            <div className="mt-4">
                                <label className="text-[11px] font-bold text-slate-400 tracking-widest block text-center mb-1">你的名字</label>
                                <input
                                    value={selectedProfile.name}
                                    onChange={(e) => updateSelectedProfile({ name: e.target.value })}
                                    placeholder="点击输入名字"
                                    className="w-full bg-slate-50 focus:bg-white border border-transparent focus:border-primary/30 rounded-2xl px-4 py-3 text-xl font-bold text-slate-800 text-center outline-none transition-all placeholder:text-slate-300 placeholder:font-normal"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-[1.75rem] shadow-[0_10px_30px_-12px_rgba(80,70,120,0.18)] border border-slate-100 p-5">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="w-7 h-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                                </svg>
                            </span>
                            <h2 className="text-sm font-bold text-slate-700">关于我 / 设定</h2>
                        </div>
                        <textarea
                            value={selectedProfile.bio}
                            onChange={(e) => updateSelectedProfile({ bio: e.target.value })}
                            className="w-full h-36 bg-slate-50 focus:bg-white border border-slate-100 focus:border-primary/30 rounded-2xl px-4 py-3 text-sm text-slate-700 leading-relaxed resize-none outline-none transition-all placeholder:text-slate-300"
                            placeholder="描述你自己..."
                        />
                        <label className="text-[11px] font-bold text-slate-400 tracking-widest block mt-4 mb-1 pl-1">补充身份提示词</label>
                        <textarea
                            value={selectedProfile.personaPrompt || ''}
                            onChange={(e) => updateSelectedProfile({ personaPrompt: e.target.value })}
                            className="w-full h-28 bg-slate-50 focus:bg-white border border-slate-100 focus:border-primary/30 rounded-2xl px-4 py-3 text-sm text-slate-700 leading-relaxed resize-none outline-none transition-all placeholder:text-slate-300"
                            placeholder="例如：这次以旁白、玩家、原创主角或另一个身份和角色互动..."
                        />
                    </div>

                    <div className="bg-white rounded-[1.75rem] shadow-[0_10px_30px_-12px_rgba(80,70,120,0.18)] border border-slate-100 p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="w-7 h-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6.75 18 9m0 0-2.25 2.25M18 9H9.75A3.75 3.75 0 0 0 6 12.75v0A3.75 3.75 0 0 0 9.75 16.5H18" />
                                </svg>
                            </span>
                            <h2 className="text-sm font-bold text-slate-700">角色绑定</h2>
                        </div>
                        <div className="space-y-2">
                            {characters.map(char => (
                                <div key={char.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-3 py-2">
                                    <img src={char.avatar} className="w-9 h-9 rounded-full object-cover bg-slate-100 shrink-0" alt="" />
                                    <div className="min-w-0 flex-1">
                                        <div className="text-xs font-black text-slate-700 truncate">{char.name}</div>
                                    </div>
                                    <select
                                        value={characterUserProfileBindings[char.id] || DEFAULT_USER_PROFILE_ID}
                                        onChange={(e) => bindUserProfileToCharacter(char.id, e.target.value)}
                                        className="max-w-[150px] rounded-xl border border-slate-100 bg-white px-2.5 py-2 text-xs font-bold text-slate-600 outline-none"
                                    >
                                        {userProfiles.map(profile => (
                                            <option key={profile.id} value={profile.id || DEFAULT_USER_PROFILE_ID}>
                                                {profile.name || profile.label || '未命名'}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                    </div>
                </>}
            </div>
        </div>
    );
};

export default UserApp;
