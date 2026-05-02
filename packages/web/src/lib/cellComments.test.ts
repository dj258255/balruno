import { describe, it, expect } from 'vitest';
import { parseMentions, getMentionContext } from './cellComments';

describe('parseMentions', () => {
  it('여러 @mention 추출 (중복 제거)', () => {
    expect(parseMentions('@alice 그리고 @bob 또 @alice')).toEqual(['alice', 'bob']);
  });

  it('너무 짧은 @ (1글자) 는 무시', () => {
    // regex 는 {2,32} — @a 는 매치 안 됨
    expect(parseMentions('@a 짧음')).toEqual([]);
  });

  it('특수문자는 멈춤', () => {
    expect(parseMentions('@alice!hello')).toEqual(['alice']);
  });

  it('mention 없으면 빈 배열', () => {
    expect(parseMentions('일반 텍스트')).toEqual([]);
  });
});

describe('getMentionContext', () => {
  it('@ 뒤 바로 caret: prefix ""', () => {
    expect(getMentionContext('hi @', 4)).toEqual({ prefix: '', start: 3 });
  });

  it('@ 뒤 타이핑 중: prefix 추출', () => {
    expect(getMentionContext('hi @ali', 7)).toEqual({ prefix: 'ali', start: 3 });
  });

  it('텍스트 시작 @', () => {
    expect(getMentionContext('@bob', 4)).toEqual({ prefix: 'bob', start: 0 });
  });

  it('@ 앞에 문자 있으면 null (이메일 등)', () => {
    // "user@site" 의 @ 는 mention 이 아님
    expect(getMentionContext('user@site', 9)).toBeNull();
  });

  it('공백 있는 prefix 는 멘션 아님', () => {
    expect(getMentionContext('hi @ali ce', 10)).toBeNull();
  });

  it('@ 없는 위치는 null', () => {
    expect(getMentionContext('regular text', 12)).toBeNull();
  });

  it('caret 앞이 특수문자면 null', () => {
    expect(getMentionContext('hi!ab', 5)).toBeNull();
  });

  it('시작 부분 caret=0 은 null', () => {
    expect(getMentionContext('', 0)).toBeNull();
  });
});
