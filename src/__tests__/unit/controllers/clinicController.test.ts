import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { clinicController } from '../../../controllers/clinicController';
import { clinicService, Clinic } from '../../../services/clinicService';
import { UserRole, CompleteUser } from '../../../types/auth';
import logger from '../../../config/logger';

// Extender el tipo Request para incluir la propiedad user en los tests
interface MockRequest extends Partial<Request> {
  user?: CompleteUser;
}

// Mock del servicio de clínicas
vi.mock('../../../services/clinicService');
vi.mock('../../../config/logger');

// Mock de UUID
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-123')
}));

describe('ClinicController Unit Tests', () => {
    let mockRequest: MockRequest;
    let mockResponse: Partial<Response>;
    let mockNext: any;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Mock request object
        mockRequest = {
            body: {},
            params: {},
            query: {},
            user: {
                auth: {
                    id: 'user-123',
                    email: 'test@example.com',
                    app_metadata: {},
                    user_metadata: {},
                    aud: 'authenticated',
                    created_at: new Date().toISOString()
                } as any,
                profile: {
                    id: 'user-123',
                    email: 'test@example.com',
                    first_name: 'Test',
                    last_name: 'User',
                    phone: '+52 55 1234 5678',
                    clinic_id: 'clinic-123',
                    role: UserRole.SYSTEM_ADMIN,
                    is_active: true,
                    language: 'es',
                    timezone: 'America/Mexico_City',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                },
                clinic: {
                    id: 'clinic-123',
                    clinic_name: 'Test Clinic',
                    is_active: true
                }
            }
        };

        // Mock response object
        mockResponse = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis()
        };

        // Mock next function
        mockNext = vi.fn();
    });

    describe('createClinic', () => {
        it('debería crear una clínica exitosamente', async () => {
            // Arrange
            const clinicData = {
                clinic_name: 'Clínica Test',
                clinic_code: 'TEST001',
                phone: '+52 55 1234 5678',
                email: 'test@clinic.com'
            };

            const mockCreatedClinic: Clinic = {
                id: 'clinic-123',
                clinic_name: 'Clínica Test',
                clinic_code: 'TEST001',
                phone: '+52 55 1234 5678',
                email: 'test@clinic.com',
                country: 'México',
                timezone: 'America/Mexico_City',
                currency: 'MXN',
                language: 'es',
                subscription_plan: 'basic',
                max_users: 5,
                max_patients: 1000,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            mockRequest.body = clinicData;
            vi.mocked(clinicService.createClinic).mockResolvedValue(mockCreatedClinic);

            // Act
            await clinicController.createClinic(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(clinicService.createClinic).toHaveBeenCalledWith(expect.objectContaining(clinicData), 'test-uuid-123');
            expect(mockResponse.status).toHaveBeenCalledWith(201);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: true,
                message: 'Clínica creada exitosamente',
                data: mockCreatedClinic
            });
        });

        it('debería manejar errores del servicio', async () => {
            // Arrange
            mockRequest.body = { 
                clinic_name: 'Test Clinic',
                clinic_code: 'TEST001'
            };
            const error = new Error('Error del servicio');
            vi.mocked(clinicService.createClinic).mockRejectedValue(error);

            // Act
            await clinicController.createClinic(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(logger.error).toHaveBeenCalled();
        });

        it('debería manejar datos inválidos con Zod', async () => {
            // Arrange
            mockRequest.body = { 
                clinic_name: 'A', // Muy corto (mínimo 2 caracteres)
                clinic_code: 'invalid-code!' // Contiene caracteres no permitidos
            };

            // Act
            await clinicController.createClinic(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                message: 'Datos de entrada inválidos'
            }));
        });
    });

    describe('listClinics', () => {
        it('debería obtener lista de clínicas con paginación', async () => {
            // Arrange
            const mockResult = {
                clinics: [
                    { id: '1', clinic_name: 'Clínica 1' } as Clinic,
                    { id: '2', clinic_name: 'Clínica 2' } as Clinic
                ],
                page: 1,
                limit: 10,
                total: 2,
                totalPages: 1
            };

            mockRequest.query = { page: '1', limit: '10' };
            vi.mocked(clinicService.listClinics).mockResolvedValue(mockResult);

            // Act
            await clinicController.listClinics(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(clinicService.listClinics).toHaveBeenCalledWith({
                page: 1,
                limit: 10
            }, expect.any(String));
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: true,
                data: mockResult.clinics,
                pagination: {
                    page: 1,
                    limit: 10,
                    total: 2,
                    totalPages: 1
                }
            });
        });

        it('debería usar valores por defecto para paginación', async () => {
            // Arrange
            mockRequest.query = {}; // Sin parámetros
            const mockResult = {
                clinics: [],
                page: 1,
                limit: 10,
                total: 0,
                totalPages: 0
            };
            vi.mocked(clinicService.listClinics).mockResolvedValue(mockResult);

            // Act
            await clinicController.listClinics(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(clinicService.listClinics).toHaveBeenCalledWith({
                page: 1,
                limit: 10
            }, expect.any(String));
        });
    });

    describe('getClinicById', () => {
        it('debería obtener clínica por ID exitosamente', async () => {
            // Arrange
            const clinicId = 'clinic-123';
            const mockClinic: Clinic = {
                id: clinicId,
                clinic_name: 'Clínica Test',
                clinic_code: 'TEST001',
                email: 'test@clinic.com',
                country: 'México',
                timezone: 'America/Mexico_City',
                currency: 'MXN',
                language: 'es',
                subscription_plan: 'basic',
                max_users: 5,
                max_patients: 1000,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            mockRequest.params = { id: clinicId };
            vi.mocked(clinicService.getClinicById).mockResolvedValue(mockClinic);

            // Act
            await clinicController.getClinicById(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(clinicService.getClinicById).toHaveBeenCalledWith(clinicId, expect.any(String));
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: true,
                data: mockClinic
            });
        });

        it('debería manejar clínica no encontrada', async () => {
            // Arrange
            mockRequest.params = { id: 'nonexistent' };
            vi.mocked(clinicService.getClinicById).mockResolvedValue(null);

            // Act
            await clinicController.getClinicById(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                message: 'Clínica no encontrada'
            });
        });

        it('debería validar que el ID no sea undefined', async () => {
            // Arrange
            mockRequest.params = {}; // Sin ID

            // Act
            await clinicController.getClinicById(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                message: 'ID de clínica requerido'
            });
        });
    });

    describe('updateClinic', () => {
        it('debería actualizar clínica exitosamente', async () => {
            // Arrange
            const clinicId = 'clinic-123';
            const updateData = {
                clinic_name: 'Clínica Actualizada',
                email: 'updated@clinic.com'
            };
            const mockUpdatedClinic: Clinic = {
                id: clinicId,
                clinic_name: 'Clínica Actualizada',
                clinic_code: 'TEST001',
                email: 'updated@clinic.com',
                country: 'México',
                timezone: 'America/Mexico_City',
                currency: 'MXN',
                language: 'es',
                subscription_plan: 'basic',
                max_users: 5,
                max_patients: 1000,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            mockRequest.params = { id: clinicId };
            mockRequest.body = updateData;
            vi.mocked(clinicService.updateClinic).mockResolvedValue(mockUpdatedClinic);

            // Act
            await clinicController.updateClinic(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(clinicService.updateClinic).toHaveBeenCalledWith(clinicId, expect.objectContaining(updateData), 'test-uuid-123');
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: true,
                message: 'Clínica actualizada exitosamente',
                data: mockUpdatedClinic
            });
        });
    });

    describe('toggleClinicStatus', () => {
        it('debería cambiar estado de clínica exitosamente', async () => {
            // Arrange
            const clinicId = 'clinic-123';
            const newStatus = false;
            const mockUpdatedClinic: Clinic = {
                id: clinicId,
                clinic_name: 'Test Clinic',
                clinic_code: 'TEST001',
                country: 'México',
                timezone: 'America/Mexico_City',
                currency: 'MXN',
                language: 'es',
                subscription_plan: 'basic',
                max_users: 5,
                max_patients: 1000,
                is_active: newStatus,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            mockRequest.params = { id: clinicId };
            mockRequest.body = { is_active: newStatus };
            vi.mocked(clinicService.toggleClinicStatus).mockResolvedValue(mockUpdatedClinic);

            // Act
            await clinicController.toggleClinicStatus(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(clinicService.toggleClinicStatus).toHaveBeenCalledWith(clinicId, newStatus, expect.any(String));
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: true,
                message: `Clínica ${newStatus ? 'activada' : 'desactivada'} exitosamente`,
                data: mockUpdatedClinic
            });
        });
    });

    describe('getClinicStats', () => {
        it('debería obtener estadísticas de clínica exitosamente', async () => {
            // Arrange
            const clinicId = 'clinic-123';
            const mockStats = {
                total_patients: 150,
                total_appointments: 500,
                total_treatments: 300,
                active_patients: 120,
                monthly_revenue: 50000
            };

            mockRequest.params = { id: clinicId };
            vi.mocked(clinicService.getClinicStats).mockResolvedValue(mockStats);

            // Act
            await clinicController.getClinicStats(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(clinicService.getClinicStats).toHaveBeenCalledWith(clinicId, expect.any(String));
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: true,
                data: mockStats
            });
        });

        it('debería manejar clínica no encontrada para estadísticas', async () => {
            // Arrange
            mockRequest.params = { id: 'nonexistent' };
            vi.mocked(clinicService.getClinicStats).mockResolvedValue(null);

            // Act
            await clinicController.getClinicStats(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                message: 'Clínica no encontrada'
            });
        });
    });

    describe('Validaciones generales', () => {
        it('debería manejar datos inválidos con ZodError', async () => {
            // Arrange
            mockRequest.body = { 
                clinic_name: 'A', // Muy corto (mínimo 2 caracteres)
                clinic_code: 'invalid-code!' // Contiene caracteres no permitidos
            };

            // Act
            await clinicController.createClinic(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                message: 'Datos de entrada inválidos'
            }));
        });

        it('debería manejar errores internos del servidor', async () => {
            // Arrange
            const validData = {
                clinic_name: 'Test Clinic',
                clinic_code: 'TEST001',
                email: 'test@clinic.com',
                phone: '+52 55 1234 5678',
                address: 'Test Address',
                city: 'Test City',
                state: 'Test State',
                postal_code: '12345'
            };
            mockRequest.body = validData;
            vi.mocked(clinicService.createClinic).mockRejectedValue(new Error('Database error'));

            // Act
            await clinicController.createClinic(mockRequest as Request, mockResponse as Response);

            // Assert
            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith({
                success: false,
                message: 'Error interno del servidor'
            });
        });
    });
});