// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreditCardModal } from '../components/credit-card/CreditCardModal';
import { SimCardModal } from '../components/sim-card/SimCardModal';
import { UCardModal } from '../components/u-card/UCardModal';
import { PerkModal } from '../components/perk/PerkModal';
import { BestConfigModal } from '../components/ai-hub/BestConfigModal';
import { copyToClipboard } from './clipboard';

vi.mock('./clipboard', () => ({ copyToClipboard: vi.fn() }));
vi.mock('./use-modal-lock', () => ({ useModalLock: vi.fn() }));
vi.mock('./card-art', () => ({ getCreditCardArt: () => '', getSimCardArt: () => '', getPerkArt: () => '' }));
vi.mock('../components/account/ItemMarkControl', () => ({ ItemMarkControl: () => null }));
vi.mock('../components/awesome-ui/UiIcon', () => ({ UiIcon: () => null }));
vi.mock('./api-station-sync', () => ({ generateNewApiChannelJson: () => ({}), generateBatchNewApiImportJson: () => ({}), generateChannelsBatchCurlScript: () => 'curl' }));

const credit = { id: 'a', name: 'A', issuer: '', regionName: '', currency: '', network: '', annualFee: '', foreignTxFee: '', creditScoreLevel: '', features: [], affCode: 'code' };
const sim = { id: 'a', name: 'A', countryCode: '', country: '', form: [], maintenanceCost: '', topUpMethods: [], affCode: 'code' };
const ucard = { slug: 'a', brand: 'A', img: '', detail: { inviteCode: 'code' } };
const perk = { id: 'a', name: 'A', validity: '', highlights: [] };
const rec = (id: string) => ({ station: { id, name: id }, tier: 'x', matchedExistingModels: [], expandedNewModels: [], recommendedModels: [] });
const analysis = { recommendations: [rec('a'), rec('b')] };
let root: Root;
let container: HTMLDivElement;
const mockCopy = vi.mocked(copyToClipboard);
const render = async (node: React.ReactNode) => { await act(async () => root.render(node)); };
const click = async (selector: string, index = 0) => {
  const button = container.querySelectorAll<HTMLElement>(selector)[index];
  expect(button).toBeTruthy();
  await act(async () => button.click());
};
const advance = async (ms: number) => { await act(async () => vi.advanceTimersByTime(ms)); };

beforeEach(() => {
  vi.useFakeTimers();
  mockCopy.mockReset().mockResolvedValue(true);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); });

const cases = [
  { name: 'credit', node: (id: string | null) => <CreditCardModal card={id ? { ...credit, id } as any : null} onClose={() => {}} /> },
  { name: 'sim', node: (id: string | null) => <SimCardModal card={id ? { ...sim, id } as any : null} onClose={() => {}} /> },
  { name: 'u-card', node: (id: string | null) => <UCardModal card={id ? { ...ucard, slug: id } as any : null} allCards={[]} onSelectVariant={() => {}} onClose={() => {}} /> },
  { name: 'perk', node: (id: string | null) => <PerkModal perk={id ? { ...perk, id } as any : null} onClose={() => {}} /> },
];

describe.each(cases)('$name copy feedback', ({ node }) => {
  it('extends the feedback from the latest successful copy', async () => {
    await render(node('a')); await click('.share-pill'); await advance(1500); await click('.share-pill'); await advance(500);
    expect(container.querySelector('.share-pill')?.classList.contains('copied')).toBe(true);
    await advance(1500); expect(container.querySelector('.share-pill')?.classList.contains('copied')).toBe(false);
  });
  it('clears feedback when switching or reopening and ignores stale async results', async () => {
    await render(node('a')); await click('.share-pill'); await render(node('b'));
    expect(container.querySelector('.share-pill')?.classList.contains('copied')).toBe(false);
    let resolve!: (success: boolean) => void;
    mockCopy.mockReturnValueOnce(new Promise<boolean>(r => { resolve = r; }));
    await click('.share-pill'); await render(node(null)); await render(node('b'));
    await act(async () => resolve(true));
    expect(container.querySelector('.share-pill')?.classList.contains('copied')).toBe(false);
  });
});

describe.each(cases.filter(({ name }) => name !== 'perk'))('$name independent copy channels', ({ node }) => {
  it('keeps code and share timers independent and handles failed copies', async () => {
    await render(node('a')); await click('.invite-pill'); await advance(1000); await click('.share-pill');
    await advance(1000);
    expect(container.querySelector('.invite-pill')?.classList.contains('copied')).toBe(false);
    expect(container.querySelector('.share-pill')?.classList.contains('copied')).toBe(true);
    mockCopy.mockResolvedValueOnce(false);
    await click('.invite-pill');
    expect(container.querySelector('.invite-pill')?.classList.contains('copied')).toBe(false);
    await advance(1000);
    expect(container.querySelector('.share-pill')?.classList.contains('copied')).toBe(false);
  });
});

describe('BestConfigModal', () => {
  const node = (isOpen: boolean) => <BestConfigModal isOpen={isOpen} onClose={() => {}} analysis={analysis as any} apiEndpoint="https://example.com" />;
  it('keeps batch and curl feedback independent across tabs', async () => {
    await render(node(true));
    const byText = async (text: string) => {
      const button = [...container.querySelectorAll('button')].find(b => b.textContent?.includes(text));
      expect(button).toBeTruthy();
      await act(async () => button!.click());
    };
    await byText('New API 批量 JSON'); await byText('一键复制全部渠道 JSON');
    await advance(1000); await byText('cURL 终端脚本'); await byText('复制终端 cURL 脚本');
    await advance(1000); expect(container.textContent).toContain('已复制脚本');
    await byText('New API 批量 JSON'); expect(container.textContent).not.toContain('已复制全部');
    await advance(1000); await byText('cURL 终端脚本'); expect(container.textContent).not.toContain('已复制脚本');
  });
  it('extends single channel feedback and clears pending copies on close', async () => {
    await render(node(true));
    const selector = 'button[title="复制单个渠道的 New API JSON"]';
    await click(selector, 0); await advance(1500); await click(selector, 1); await advance(500);
    expect(container.querySelectorAll(selector)[1].textContent).toContain('已复制');
    await advance(1500);
    expect(container.querySelectorAll(selector)[1].textContent).not.toContain('已复制');
    let resolve!: (success: boolean) => void;
    mockCopy.mockReturnValueOnce(new Promise<boolean>(r => { resolve = r; }));
    await click(selector, 0); await render(node(false)); await render(node(true));
    await act(async () => resolve(true));
    expect(container.querySelectorAll(selector)[0].textContent).not.toContain('已复制');
  });
  it('renders safely across close and reopen and rejects an older single-copy result', async () => {
    await render(node(false)); await render(node(true));
    let resolve!: (success: boolean) => void;
    mockCopy.mockReturnValueOnce(new Promise<boolean>(r => { resolve = r; }));
    await click('button[title="复制单个渠道的 New API JSON"]', 0);
    await click('button[title="复制单个渠道的 New API JSON"]', 1);
    await act(async () => resolve(true));
    const buttons = container.querySelectorAll('button[title="复制单个渠道的 New API JSON"]');
    expect(buttons[1].textContent).toContain('已复制');
    expect(buttons[0].textContent).not.toContain('已复制');
    await render(node(false)); await render(node(true));
    expect(container.textContent).not.toContain('已复制');
  });
});
