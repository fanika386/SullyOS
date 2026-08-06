import type { WorldbookSkin, WorldbookSkinTokens } from '../types';

export const WORLDBOOK_SKIN_CLASSIC_ID = 'wb-skin-classic';
export const WORLDBOOK_SKIN_CLAUDE_ID = 'wb-skin-claude';
export const WORLDBOOK_ACTIVE_SKIN_KEY = 'wb_active_skin';

/** 经典皮肤：尽量还原当前世界书的默认观感。 */
const CLASSIC_TOKENS: WorldbookSkinTokens = {
    canvas: '#F1F5F9',
    surface: '#FFFFFF',
    surfaceAlt: '#F8FAFC',
    border: '#E2E8F0',
    text: '#1E293B',
    textSecondary: '#64748B',
    textMuted: '#94A3B8',
    primary: '#6366F1',
    primaryActive: '#4F46E5',
    primarySoft: '#EEF2FF',
    success: '#059669',
    successSoft: '#ECFDF5',
    warning: '#D97706',
    warningSoft: '#FFFBEB',
    danger: '#DC2626',
    dangerSoft: '#FEF2F2',
    radiusCard: 16,
    radiusInput: 12,
    radiusButton: 999,
    fontHeading: 'sans',
};

/** Claude 皮肤：Anthropic 官方 DESIGN.md 令牌（奶油底 + 珊瑚橙 + 衬线标题）。 */
const CLAUDE_TOKENS: WorldbookSkinTokens = {
    canvas: '#FAF9F5',
    surface: '#FFFFFF',
    surfaceAlt: '#F5F0E8',
    border: '#E6DFD8',
    text: '#141413',
    textSecondary: '#3D3D3A',
    textMuted: '#8E8B82',
    primary: '#CC785C',
    primaryActive: '#A9583E',
    primarySoft: '#FBF0EA',
    success: '#5DB872',
    successSoft: '#EDF6EF',
    warning: '#D4A017',
    warningSoft: '#FBF3E0',
    danger: '#C64545',
    dangerSoft: '#FBEAEA',
    radiusCard: 10,
    radiusInput: 8,
    radiusButton: 8,
    fontHeading: 'serif',
};

export const BUILTIN_WORLDBOOK_SKINS: WorldbookSkin[] = [
    { id: WORLDBOOK_SKIN_CLASSIC_ID, name: '经典', createdAt: 0, isBuiltin: true, tokens: CLASSIC_TOKENS },
    { id: WORLDBOOK_SKIN_CLAUDE_ID, name: 'Claude', createdAt: 1, isBuiltin: true, tokens: CLAUDE_TOKENS },
];

export const DEFAULT_WORLDBOOK_SKIN_ID = WORLDBOOK_SKIN_CLASSIC_ID;

export const getDefaultWorldbookSkin = (): WorldbookSkin => BUILTIN_WORLDBOOK_SKINS[0];

/** 把皮肤令牌展开成 CSS 变量，挂在世界书根节点上，全部子元素通过 var() 读取。 */
export const worldbookSkinCssVars = (skin: WorldbookSkin): Record<string, string> => {
    const t = skin.tokens;
    return {
        '--wb-canvas': t.canvas,
        '--wb-surface': t.surface,
        '--wb-surface-alt': t.surfaceAlt,
        '--wb-border': t.border,
        '--wb-text': t.text,
        '--wb-text2': t.textSecondary,
        '--wb-muted': t.textMuted,
        '--wb-primary': t.primary,
        '--wb-primary-active': t.primaryActive,
        '--wb-primary-soft': t.primarySoft,
        '--wb-success': t.success,
        '--wb-success-soft': t.successSoft,
        '--wb-warning': t.warning,
        '--wb-warning-soft': t.warningSoft,
        '--wb-danger': t.danger,
        '--wb-danger-soft': t.dangerSoft,
        '--wb-radius-card': `${t.radiusCard}px`,
        '--wb-radius-input': `${t.radiusInput}px`,
        '--wb-radius-button': `${t.radiusButton}px`,
        '--wb-font-heading': t.fontHeading === 'serif'
            ? `Georgia, "Songti SC", "Noto Serif SC", serif`
            : `-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`,
    };
};

export const isWorldbookSkinShape = (value: any): value is WorldbookSkin => {
    if (!value || typeof value !== 'object') return false;
    if (typeof value.id !== 'string' || typeof value.name !== 'string') return false;
    const t = value.tokens;
    if (!t || typeof t !== 'object') return false;
    return typeof t.canvas === 'string'
        && typeof t.surface === 'string'
        && typeof t.border === 'string'
        && typeof t.text === 'string'
        && typeof t.primary === 'string'
        && typeof t.radiusCard === 'number';
};
