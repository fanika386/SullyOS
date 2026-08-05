import { Message } from '../types';
import { stripMessageJunk } from '../components/chat/MessageItem';

// 非文字消息复制时保留占位符，让段落顺序和"这里有条图/卡片"的信息不丢。
const nonTextLabels: Record<string, string> = {
    image: '[图片]',
    emoji: '[表情]',
    interaction: '[互动]',
    transfer: '[转账]',
    system: '[系统消息]',
    social_card: '[社交卡片]',
    chat_forward: '[转发记录]',
    xhs_card: '[小红书卡片]',
    score_card: '[评分卡]',
    music_card: '[音乐卡片]',
    mcd_card: '[麦当劳卡片]',
    luckin_card: '[瑞幸卡片]',
    html_card: '[网页卡片]',
    news_card: '[新闻卡片]',
    vr_card: '[VR卡片]',
    trpg_card: '[跑团卡片]',
    novel_card: '[小说卡片]',
    world_card: '[世界卡片]',
    sim_card: '[模拟卡片]',
    phone_card: '[通话卡片]',
    webpage_card: '[网页卡片]',
    theater_card: '[剧场卡片]',
    room_card: '[房间卡片]',
    life_card: '[生活卡片]',
    group_topic_card: '[话题卡片]',
};

/** 把一批消息按顺序拼成可复制的文本段落：文字消息走气泡显示同款清洗，非文字消息留占位符。 */
export const buildCopyTextFromMessages = (msgs: Message[]): string[] => (
    msgs
        .map(m => (
            m.type === 'text' ? stripMessageJunk(m.content) : (nonTextLabels[m.type] || `[${m.type}]`)
        ))
        .filter(t => t.trim().length > 0)
);
