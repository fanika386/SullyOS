import { describe, expect, it } from 'vitest';
import { ContextBuilder } from './context';

describe('ContextBuilder user profile personas', () => {
  it('sends bio and legacy personaPrompt as one user profile setting', () => {
    const context = ContextBuilder.buildCoreContext(
      { id: 'c1', name: '小角色', systemPrompt: '你是小角色' } as any,
      {
        id: 'persona_alt',
        name: '面具我',
        avatar: 'alt.png',
        bio: '公开给角色看的身份说明',
        personaPrompt: '只在这个面具里出现的额外身份设定',
      } as any,
      true,
    );

    expect(context).toContain('### 互动对象 (User)');
    expect(context).toContain('- 名字: 面具我');
    expect(context).toContain('- 设定/备注: 公开给角色看的身份说明\n\n只在这个面具里出现的额外身份设定');
    expect(context).not.toContain('- 额外身份设定:');
  });
});
