import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../account/ItemMarkControl', () => ({ ItemStatusBadge: () => null }));
import { AiStationItem } from './AiStationItem';
import { parseNewApiChannelsJson } from '../../utils/api-station-sync';

const station = parseNewApiChannelsJson(JSON.stringify({ name: 'Test', base_url: 'https://example.com' }))[0];
describe('station health presentation', () => {
  it('does not claim an unverified browser probe is testing availability', () => {
    const html = renderToStaticMarkup(<AiStationItem station={station} onSelect={() => {}} />);
    expect(html).toContain('状态未知');
    expect(html).not.toContain('测速中');
  });
  it('identifies backend latency as a historical test rather than current health', () => {
    const html = renderToStaticMarkup(<AiStationItem station={{...station, responseTime: 32}} onSelect={() => {}} />);
    expect(html).toContain('上次测试');
  });
});
