import { nightRunMode } from '../schedule';

describe('nightRunMode', () => {
  it('sweeps on the 03:00 Paris run only, summer and winter time', () => {
    expect(nightRunMode(new Date('2026-07-01T01:00:00Z'))).toBe('sweep'); // 03:00 CEST
    expect(nightRunMode(new Date('2026-12-01T02:00:00Z'))).toBe('sweep'); // 03:00 CET
    expect(nightRunMode(new Date('2026-07-01T19:00:00Z'))).toBe('incremental'); // 21:00
    expect(nightRunMode(new Date('2026-12-01T05:00:00Z'))).toBe('incremental'); // 06:00
  });
});
