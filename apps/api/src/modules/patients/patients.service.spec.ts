import { BadRequestException } from '@nestjs/common';
import { Gender } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreatePatientDto } from './dto/patient.dto';
import { PatientsService } from './patients.service';

describe('PatientsService', () => {
  const prisma = {
    patient: {
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
    },
  };
  const auditService = { log: jest.fn() };
  let service: PatientsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.patient.count.mockResolvedValue(0);
    prisma.patient.findFirst.mockResolvedValue(null);
    prisma.patient.create.mockResolvedValue({ id: 'patient-1' });
    auditService.log.mockResolvedValue(undefined);
    service = new PatientsService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
    );
  });

  const patientDto = (dateOfBirth: string): CreatePatientDto => ({
    firstName: '  Aditi ',
    lastName: ' Nair ',
    phone: '9000000001',
    dateOfBirth,
    gender: Gender.FEMALE,
  });

  it('rejects a future date of birth before writing a patient', async () => {
    await expect(
      service.create(patientDto('2999-01-01'), 'receptionist-1'),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.patient.create).not.toHaveBeenCalled();
  });

  it('warns on a matching phone without blocking registration', async () => {
    prisma.patient.findFirst.mockResolvedValue({ id: 'existing-patient' });

    const result = await service.create(
      patientDto('1990-04-12'),
      'receptionist-1',
    );

    expect(prisma.patient.findFirst).toHaveBeenCalledWith({
      where: { phone: '9000000001', isActive: true },
    });
    expect(prisma.patient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          firstName: 'Aditi',
          lastName: 'Nair',
          patientCode: expect.stringMatching(/^PAT-\d{8}-0001$/),
        }),
      }),
    );
    expect(result).toEqual({
      data: { id: 'patient-1' },
      meta: { duplicateWarning: true, existingPatientId: 'existing-patient' },
    });
  });
});
