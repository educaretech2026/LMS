import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('Health Probes', () => {
    it('getHealth should return status healthy', () => {
      const res = appController.getHealth();
      expect(res.status).toBe('healthy');
      expect(res.timestamp).toBeDefined();
    });

    it('getLiveness should return status alive with uptime', () => {
      const res = appController.getLiveness();
      expect(res.status).toBe('alive');
      expect(typeof res.uptimeSecs).toBe('number');
      expect(res.timestamp).toBeDefined();
    });

    it('getReadiness should return status ready when dependencies healthy', async () => {
      const res = await appController.getReadiness();
      expect(res.status).toBe('ready');
      expect(res.checks).toBeDefined();
    });

    it('getReadiness should throw ServiceUnavailableException when MAINTENANCE_MODE=true', async () => {
      process.env.MAINTENANCE_MODE = 'true';
      await expect(appController.getReadiness()).rejects.toThrow(
        /System is undergoing planned maintenance. Traffic drained./,
      );
      delete process.env.MAINTENANCE_MODE;
    });

    it('getReadiness should throw ServiceUnavailableException when database fails', async () => {
      const mockPrisma = {
        $queryRaw: jest.fn().mockRejectedValue(new Error('Connection lost')),
      };
      const controllerWithDb = new AppController(new AppService(), mockPrisma as any);
      await expect(controllerWithDb.getReadiness()).rejects.toThrow(
        /Database check failed/,
      );
    });
  });
});
