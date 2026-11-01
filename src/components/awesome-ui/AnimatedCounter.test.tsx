import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnimatedCounter } from './AnimatedCounter';

describe('AnimatedCounter', () => {
  it('renders its initial start value rather than flashing the target before animation', () => {
    const html = renderToStaticMarkup(<AnimatedCounter target={100} start={5} delay={500} suffix="+" />);
    expect(html).toContain('aria-label="100+"');
    expect(html).toContain('>5+<');
  });
});
