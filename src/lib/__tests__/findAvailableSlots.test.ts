/**
 * Tests for findAvailableSlots function
 * 
 * Run with: npx jest src/lib/__tests__/findAvailableSlots.test.ts
 * Or: npm test -- --testPathPattern=findAvailableSlots
 * 
 * First install Jest: npm install --save-dev jest @types/jest ts-jest
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/// <reference types="jest" />

import {
  findAvailableSlots,
  FindSlotsOptions,
  AvailableSlot,
  BusyBlock,
} from '../findAvailableSlots';

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        in: jest.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
  })),
}));

import { createClient } from '@supabase/supabase-js';

const mockSupabase = createClient as jest.Mock;

// Helper to create mock user status
function createMockUserStatus(userId: string, busyBlocks: BusyBlock[]) {
  return {
    user_id: userId,
    busy_blocks: busyBlocks,
  };
}

// Helper to set up Supabase mock response
function setupMockResponse(statuses: ReturnType<typeof createMockUserStatus>[]) {
  mockSupabase.mockReturnValue({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        in: jest.fn(() => Promise.resolve({ data: statuses, error: null })),
      })),
    })),
  });
}

describe('findAvailableSlots', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  });

  describe('Input Validation', () => {
    test('returns empty array when no users specified', async () => {
      const result = await findAvailableSlots({ userIds: [] });
      expect(result).toEqual([]);
    });

    test('throws error when minDuration is less than 1', async () => {
      await expect(
        findAvailableSlots({ userIds: ['user1'], minDuration: 0 })
      ).rejects.toThrow('Minimum duration must be at least 1 minute');
    });

    test('throws error when working hours are invalid', async () => {
      await expect(
        findAvailableSlots({
          userIds: ['user1'],
          workingHoursStart: 18,
          workingHoursEnd: 9,
        })
      ).rejects.toThrow('Working hours start must be before end');
    });
  });

  describe('No Busy Blocks', () => {
    test('returns full working hours when no users have busy blocks', async () => {
      setupMockResponse([
        createMockUserStatus('user1', []),
        createMockUserStatus('user2', []),
      ]);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const result = await findAvailableSlots({
        userIds: ['user1', 'user2'],
        startDate: today,
        endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        workingHoursStart: 9,
        workingHoursEnd: 18,
      });

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].participants_free).toContain('user1');
      expect(result[0].participants_free).toContain('user2');
    });
  });

  describe('Single User Scenarios', () => {
    test('finds gap between two busy blocks', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      setupMockResponse([
        createMockUserStatus('user1', [
          { start: '09:00', end: '10:00', label: 'Meeting 1' },
          { start: '11:00', end: '12:00', label: 'Meeting 2' },
        ]),
      ]);

      const result = await findAvailableSlots({
        userIds: ['user1'],
        startDate: today,
        endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        workingHoursStart: 9,
        workingHoursEnd: 18,
        minDuration: 30,
      });

      // Should find the gap from 10:00-11:00
      const gap = result.find(slot => {
        const startHour = new Date(slot.start).getHours();
        return startHour === 10;
      });

      expect(gap).toBeDefined();
      expect(gap?.duration).toBe(60); // 1 hour gap
    });

    test('respects minimum duration filter', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      setupMockResponse([
        createMockUserStatus('user1', [
          { start: '09:00', end: '09:50', label: 'Meeting 1' },
          { start: '10:00', end: '12:00', label: 'Meeting 2' },
        ]),
      ]);

      const result = await findAvailableSlots({
        userIds: ['user1'],
        startDate: today,
        endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        minDuration: 15, // 15 minute minimum
      });

      // Should NOT find the 10-minute gap (9:50-10:00)
      const smallGap = result.find(slot => {
        const startHour = new Date(slot.start).getHours();
        const startMin = new Date(slot.start).getMinutes();
        return startHour === 9 && startMin === 50;
      });

      expect(smallGap).toBeUndefined();
    });
  });

  describe('Multiple Users Scenarios', () => {
    test('finds slots when all users are free', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      setupMockResponse([
        createMockUserStatus('user1', [
          { start: '09:00', end: '10:00', label: 'User 1 Meeting' },
        ]),
        createMockUserStatus('user2', [
          { start: '09:00', end: '10:00', label: 'User 2 Meeting' },
        ]),
      ]);

      const result = await findAvailableSlots({
        userIds: ['user1', 'user2'],
        startDate: today,
        endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        workingHoursStart: 9,
        workingHoursEnd: 12,
      });

      // Both users have the same meeting, so they should both be free from 10:00-12:00
      const slot = result.find(s => {
        const startHour = new Date(s.start).getHours();
        return startHour === 10;
      });

      expect(slot).toBeDefined();
      expect(slot?.participants_free).toEqual(['user1', 'user2']);
    });

    test('handles non-overlapping busy blocks', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      setupMockResponse([
        createMockUserStatus('user1', [
          { start: '09:00', end: '10:00', label: 'User 1 Morning' },
        ]),
        createMockUserStatus('user2', [
          { start: '10:00', end: '11:00', label: 'User 2 Later' },
        ]),
      ]);

      const result = await findAvailableSlots({
        userIds: ['user1', 'user2'],
        startDate: today,
        endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        workingHoursStart: 9,
        workingHoursEnd: 12,
      });

      // Combined busy time is 9:00-11:00, so free time is 11:00-12:00
      const freeSlot = result.find(s => {
        const startHour = new Date(s.start).getHours();
        return startHour === 11;
      });

      expect(freeSlot).toBeDefined();
      expect(freeSlot?.duration).toBe(60);
    });

    test('handles overlapping busy blocks', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      setupMockResponse([
        createMockUserStatus('user1', [
          { start: '09:00', end: '11:00', label: 'User 1 Long Meeting' },
        ]),
        createMockUserStatus('user2', [
          { start: '10:00', end: '12:00', label: 'User 2 Overlapping' },
        ]),
      ]);

      const result = await findAvailableSlots({
        userIds: ['user1', 'user2'],
        startDate: today,
        endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        workingHoursStart: 9,
        workingHoursEnd: 14,
      });

      // Merged busy time is 9:00-12:00, so free time is 12:00-14:00
      const freeSlot = result.find(s => {
        const startHour = new Date(s.start).getHours();
        return startHour === 12;
      });

      expect(freeSlot).toBeDefined();
      expect(freeSlot?.duration).toBe(120);
    });
  });

  describe('Working Hours', () => {
    test('only returns slots within working hours', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      setupMockResponse([
        createMockUserStatus('user1', []),
      ]);

      const result = await findAvailableSlots({
        userIds: ['user1'],
        startDate: today,
        endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        workingHoursStart: 9,
        workingHoursEnd: 17,
      });

      // All slots should be within 9:00-17:00
      for (const slot of result) {
        const startHour = new Date(slot.start).getHours();
        const endHour = new Date(slot.end).getHours();
        const endMin = new Date(slot.end).getMinutes();
        
        expect(startHour).toBeGreaterThanOrEqual(9);
        expect(endHour + (endMin > 0 ? 0 : 0)).toBeLessThanOrEqual(17);
      }
    });

    test('handles custom working hours', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      setupMockResponse([
        createMockUserStatus('user1', []),
      ]);

      const result = await findAvailableSlots({
        userIds: ['user1'],
        startDate: today,
        endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        workingHoursStart: 10,
        workingHoursEnd: 15,
      });

      expect(result.length).toBe(1);
      expect(result[0].duration).toBe(5 * 60); // 5 hours = 300 minutes
    });
  });

  describe('Multiple Days', () => {
    test('finds slots across multiple days', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const twoDaysLater = new Date(today);
      twoDaysLater.setDate(twoDaysLater.getDate() + 2);

      setupMockResponse([
        createMockUserStatus('user1', []),
      ]);

      const result = await findAvailableSlots({
        userIds: ['user1'],
        startDate: today,
        endDate: twoDaysLater,
        workingHoursStart: 9,
        workingHoursEnd: 17,
      });

      // Should have slots for 2 days
      expect(result.length).toBe(2);
    });
  });

  describe('ISO DateTime Format', () => {
    test('handles ISO datetime format in busy blocks', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const meetingStart = new Date(today);
      meetingStart.setHours(9, 0, 0, 0);
      
      const meetingEnd = new Date(today);
      meetingEnd.setHours(10, 0, 0, 0);

      setupMockResponse([
        createMockUserStatus('user1', [
          {
            start: meetingStart.toISOString(),
            end: meetingEnd.toISOString(),
            label: 'ISO Meeting',
          },
        ]),
      ]);

      const result = await findAvailableSlots({
        userIds: ['user1'],
        startDate: today,
        endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        workingHoursStart: 9,
        workingHoursEnd: 12,
      });

      // Should find slot from 10:00-12:00
      const slot = result.find(s => {
        const startHour = new Date(s.start).getHours();
        return startHour === 10;
      });

      expect(slot).toBeDefined();
      expect(slot?.duration).toBe(120);
    });
  });

  describe('Edge Cases', () => {
    test('handles back-to-back meetings with no gap', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      setupMockResponse([
        createMockUserStatus('user1', [
          { start: '09:00', end: '10:00', label: 'Meeting 1' },
          { start: '10:00', end: '11:00', label: 'Meeting 2' },
          { start: '11:00', end: '12:00', label: 'Meeting 3' },
        ]),
      ]);

      const result = await findAvailableSlots({
        userIds: ['user1'],
        startDate: today,
        endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        workingHoursStart: 9,
        workingHoursEnd: 12,
        minDuration: 15,
      });

      // Should find no gaps between 9:00-12:00
      const slotsBeforeNoon = result.filter(s => {
        const startHour = new Date(s.start).getHours();
        return startHour < 12;
      });

      expect(slotsBeforeNoon.length).toBe(0);
    });

    test('handles all-day blocking', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      setupMockResponse([
        createMockUserStatus('user1', [
          { start: '00:00', end: '23:59', label: 'All Day Event' },
        ]),
      ]);

      const result = await findAvailableSlots({
        userIds: ['user1'],
        startDate: today,
        endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        workingHoursStart: 9,
        workingHoursEnd: 17,
      });

      expect(result.length).toBe(0);
    });

    test('handles user with no status record', async () => {
      setupMockResponse([]); // No status records returned

      const result = await findAvailableSlots({
        userIds: ['nonexistent-user'],
        minDuration: 30,
      });

      // Should return full working hours since user has no recorded busy blocks
      expect(result.length).toBeGreaterThan(0);
    });

    test('returns slots sorted by start time', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const threeDaysLater = new Date(today);
      threeDaysLater.setDate(threeDaysLater.getDate() + 3);

      setupMockResponse([
        createMockUserStatus('user1', []),
      ]);

      const result = await findAvailableSlots({
        userIds: ['user1'],
        startDate: today,
        endDate: threeDaysLater,
      });

      // Verify sorted order
      for (let i = 1; i < result.length; i++) {
        const prevStart = new Date(result[i - 1].start).getTime();
        const currStart = new Date(result[i].start).getTime();
        expect(currStart).toBeGreaterThanOrEqual(prevStart);
      }
    });
  });

  describe('Output Format', () => {
    test('returns correct output structure', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      setupMockResponse([
        createMockUserStatus('user1', []),
      ]);

      const result = await findAvailableSlots({
        userIds: ['user1'],
        startDate: today,
        endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        workingHoursStart: 9,
        workingHoursEnd: 10,
      });

      expect(result.length).toBe(1);
      
      const slot = result[0];
      expect(slot).toHaveProperty('start');
      expect(slot).toHaveProperty('end');
      expect(slot).toHaveProperty('duration');
      expect(slot).toHaveProperty('participants_free');
      
      // Verify ISO format
      expect(slot.start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(slot.end).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      
      // Verify duration is a number
      expect(typeof slot.duration).toBe('number');
      expect(slot.duration).toBe(60);
      
      // Verify participants array
      expect(Array.isArray(slot.participants_free)).toBe(true);
      expect(slot.participants_free).toContain('user1');
    });
  });
});
