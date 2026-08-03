import { isAppVisible } from '../constants';
import { AppID } from '../types';

export type LauncherPinwheelCell = 'music' | 'appsA' | 'appsB' | 'image';

const PINWHEEL_CELLS: readonly LauncherPinwheelCell[] = ['music', 'appsA', 'appsB', 'image'];

export const getAvailableLauncherPinwheelCells = (): LauncherPinwheelCell[] =>
    PINWHEEL_CELLS.filter(cell => {
        if (cell === 'music') return isAppVisible(AppID.Music);
        if (cell === 'image') return shouldShowLauncherAppearanceEntrypoints();
        return true;
    });

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

export const shouldShowLauncherAppearanceEntrypoints = (): boolean =>
    isAppVisible(AppID.Appearance);

export const shouldShowLauncherDateEntrypoints = (): boolean =>
    isAppVisible(AppID.Date);

export const shouldShowLauncherRoomEntrypoints = (): boolean =>
    isAppVisible(AppID.Room);
