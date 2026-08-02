import { isAppVisible } from '../constants';
import { AppID } from '../types';

export type LauncherPinwheelCell = 'music' | 'appsA' | 'appsB' | 'image';

const PINWHEEL_CELLS: readonly LauncherPinwheelCell[] = ['music', 'appsA', 'appsB', 'image'];

export const getAvailableLauncherPinwheelCells = (): LauncherPinwheelCell[] =>
    PINWHEEL_CELLS.filter(cell => cell !== 'music' || isAppVisible(AppID.Music));

export const normalizeLauncherPinwheelOrder = (
    saved: readonly LauncherPinwheelCell[] | undefined,
): LauncherPinwheelCell[] => {
    const available = getAvailableLauncherPinwheelCells();
    return [
        ...(saved || []).filter((id, index, all) => available.includes(id) && all.indexOf(id) === index),
        ...available.filter(id => !(saved || []).includes(id)),
    ];
};

export const shouldShowLauncherScheduleWidget = (): boolean =>
    isAppVisible(AppID.Schedule);
