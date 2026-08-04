import React from 'react';
import { BuiltInPromptSettings } from '../../types';
import {
    BUILT_IN_PROMPT_SETTING_DEFINITIONS,
    DAILY_CHAT_BUILT_IN_PROMPT_PRESET,
    ROLEPLAY_BUILT_IN_PROMPT_PRESET,
    normalizeBuiltInPromptSettings,
    type BuiltInPromptSettingKey,
} from '../../utils/builtInPromptSettings';

interface Props {
    settings?: BuiltInPromptSettings;
    onUpdate: (patch: Partial<BuiltInPromptSettings>) => void;
}

/**
 * 角色设定页的「内置提示词」开关卡片（原在聊天设置弹窗里，已挪到角色编辑页）。
 * 控制 SullyOS 自带行为规则和功能提示词；角色设定、世界书、用户设定、记忆不会被这里关闭。
 */
const BuiltInPromptSettingsCard: React.FC<Props> = ({ settings, onUpdate }) => {
    const values = normalizeBuiltInPromptSettings(settings);
    const setValue = (key: BuiltInPromptSettingKey, value: boolean) => {
        onUpdate({ [key]: value } as Partial<BuiltInPromptSettings>);
    };

    return (
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 space-y-4">
            <div>
                <label className="text-[10px] font-bold text-violet-500 uppercase tracking-widest block">内置提示词</label>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    控制 SullyOS 自带行为规则和功能提示词；角色设定、世界书、用户设定、记忆不会被这里关闭。改完即时生效（下一条回复起算）。
                </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <button
                    type="button"
                    onClick={() => onUpdate(DAILY_CHAT_BUILT_IN_PROMPT_PRESET)}
                    className="py-2 rounded-xl bg-primary/10 text-primary text-[11px] font-bold border border-primary/20 active:scale-95 transition-transform"
                >
                    日常聊天
                </button>
                <button
                    type="button"
                    onClick={() => onUpdate(ROLEPLAY_BUILT_IN_PROMPT_PRESET)}
                    className="py-2 rounded-xl bg-slate-900 text-white text-[11px] font-bold border border-slate-900 active:scale-95 transition-transform"
                >
                    纯净 RP
                </button>
            </div>

            <div className="border-t border-slate-100 pt-3 space-y-3">
                {BUILT_IN_PROMPT_SETTING_DEFINITIONS.map(def => {
                    const enabled = values[def.key];
                    return (
                        <div key={def.key} className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-700">{def.label}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">{def.description}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setValue(def.key, !enabled)}
                                className={`w-12 h-7 rounded-full transition-colors relative shrink-0 ${enabled ? 'bg-primary' : 'bg-slate-200'}`}
                            >
                                <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default BuiltInPromptSettingsCard;
