import { describe, it, expect, vi } from 'vitest';
import { createGuestStep } from './steps/create-guest.step';

describe('Anonymous Plugin V2 Step Debug', () => {
  it('should validate basic create-guest input', () => {
    const validInput = {
      userAgent: 'Test Browser',
      ip: '127.0.0.1',
    };

    expect(() => {
      createGuestStep.validationSchema?.assert(validInput);
    }).not.toThrow();
  });

  it('should create basic guest session with minimal mock', async () => {
    const mockOrm = {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn()
        .mockResolvedValueOnce({ id: 'subject_123' })
        .mockResolvedValueOnce({ id: 'tracking_789' })
        .mockResolvedValueOnce({ id: 'session_456' }),
    };

    const mockEngine = {
      getOrm: vi.fn().mockResolvedValue(mockOrm),
      createSessionFor: vi.fn().mockResolvedValue('token_123'),
      checkSession: vi.fn().mockResolvedValue({ valid: true, subject: { id: 'subject_123' } }),
    };

    const mockContext = {
      container: {} as any,
      engine: mockEngine,
      config: {
        sessionTtlSeconds: 1800,
        maxGuestsPerFingerprint: 3,
        fingerprintRequired: false, // Simplify for testing
      },
    };

    const input = {
      userAgent: 'Test Browser',
      ip: '127.0.0.1',
    };

    const result = await createGuestStep.run(input, mockContext);

    console.log('Result:', result);
    console.log('ORM create calls:', mockOrm.create.mock.calls);

    expect(result.success).toBe(true);
    expect(mockOrm.create).toHaveBeenCalledTimes(3); // subjects + anonymous_subjects + anonymous_sessions
  });
});