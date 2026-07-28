import { MindsutraService } from '@/services/mindsutra.service';
import { PanchangService } from '@/services/panchang.service';
import { prisma } from '@/config/prisma';

jest.mock('@/config/prisma', () => ({
  __esModule: true,
  prisma: {
    panchang: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    temple: {
      findMany: jest.fn(),
    },
  },
}));

describe('Panchang Service Unit Tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('MindsutraService', () => {
    it('should generate fallback/offline Panchang when API fails or not configured', async () => {
      const mindsutra = new MindsutraService();
      const date = new Date('2026-07-25');
      const location = { lat: 19.076, lon: 72.877, timezone: 5.5 }; // Mumbai

      const data = await mindsutra.fetchPanchang(date, location.lat, location.lon, location.timezone);

      expect(data).toBeDefined();
      expect(data.tithi).toBeDefined();
      expect(data.paksha).toBeDefined();
      expect(data.rashi).toBeDefined();
      expect(data.nakshatra).toBeDefined();
      expect(data.sunrise).toBeDefined();
      expect(data.sunset).toBeDefined();
      expect(data.source).toBe('OFFLINE_GENERATOR');
    });
  });

  describe('PanchangService', () => {
    it('should fetch from database cache if record exists', async () => {
      const mockCachedData = {
        id: 'panchang_123',
        date: new Date('2026-07-25'),
        latitude: 19.076,
        longitude: 72.877,
        timezone: 5.5,
        tithi: 'Shravana Shukla Dashami',
        nakshatra: 'Anuradha',
        yoga: 'Subha',
        karana: 'Garaja',
        sunrise: '06:05 AM',
        sunset: '07:12 PM',
        rashi: 'Vrishabha',
        ayanamsa: 'Lahiri',
        paksha: 'Shukla',
        rahukaal: '09:00 AM - 10:30 AM',
        yamagand: '02:00 PM - 03:30 PM',
        gulikaal: '12:00 PM - 01:30 PM',
        choghadiyaDay: 'Amrit, Shubh',
        choghadiyaNight: 'Labh',
        rawResponse: null,
        source: 'MINDSUTRA_API',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.panchang.findUnique as jest.Mock).mockResolvedValue(mockCachedData);

      const result = await PanchangService.getPanchangForDate(new Date('2026-07-25'), 19.076, 72.877, 5.5);

      expect(prisma.panchang.findUnique).toHaveBeenCalled();
      expect(prisma.panchang.create).not.toHaveBeenCalled();
      expect(result.tithi).toBe('Shravana Shukla Dashami');
      expect(result.source).toBe('MINDSUTRA_API');
    });

    it('should fetch from API/generator and save to cache if record does not exist', async () => {
      (prisma.panchang.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.panchang.create as jest.Mock).mockImplementation((args) => Promise.resolve({
        id: 'new_panchang',
        ...args.data,
      }));

      const date = new Date('2026-07-25');
      const result = await PanchangService.getPanchangForDate(date, 19.076, 72.877, 5.5);

      expect(prisma.panchang.findUnique).toHaveBeenCalled();
      expect(prisma.panchang.create).toHaveBeenCalled();
      expect(result.source).toBe('OFFLINE_GENERATOR');
      expect(result.tithi).toBeDefined();
    });
  });
});
