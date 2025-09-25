/**
 * =================================================================
 * VALIDACIONES AVANZADAS DE CITAS
 * =================================================================
 * 
 * Este módulo contiene validaciones adicionales para el sistema de citas,
 * incluyendo horarios de trabajo, días festivos, reglas de negocio específicas
 * y validaciones de tiempo más sofisticadas.
 * 
 * =================================================================
 */

import { supabaseService as supabase } from '../config/supabase';
import logger from '../config/logger';
import { AppointmentType } from '../schemas/appointment.schemas';

// =================================================================
// INTERFACES Y TIPOS
// =================================================================

export interface WorkingHours {
  dayOfWeek: number; // 0 = Domingo, 1 = Lunes, etc.
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  isWorkingDay: boolean;
}

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
  isRecurring: boolean; // Si se repite cada año
}

export interface AppointmentDurationRules {
  [key: string]: {
    minDuration: number; // minutos
    maxDuration: number; // minutos
    defaultDuration: number; // minutos
    allowedTimeSlots: number[]; // múltiplos de minutos permitidos
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// =================================================================
// CONFIGURACIONES POR DEFECTO
// =================================================================

// Horarios de trabajo por defecto (Lunes a Viernes 8:00-18:00, Sábado 8:00-14:00)
const DEFAULT_WORKING_HOURS: WorkingHours[] = [
  { dayOfWeek: 0, startTime: '00:00', endTime: '00:00', isWorkingDay: false }, // Domingo
  { dayOfWeek: 1, startTime: '08:00', endTime: '18:00', isWorkingDay: true },  // Lunes
  { dayOfWeek: 2, startTime: '08:00', endTime: '18:00', isWorkingDay: true },  // Martes
  { dayOfWeek: 3, startTime: '08:00', endTime: '18:00', isWorkingDay: true },  // Miércoles
  { dayOfWeek: 4, startTime: '08:00', endTime: '18:00', isWorkingDay: true },  // Jueves
  { dayOfWeek: 5, startTime: '08:00', endTime: '18:00', isWorkingDay: true },  // Viernes
  { dayOfWeek: 6, startTime: '08:00', endTime: '14:00', isWorkingDay: true },  // Sábado
];

// Reglas de duración por tipo de cita
const APPOINTMENT_DURATION_RULES: AppointmentDurationRules = {
  consultation: {
    minDuration: 30,
    maxDuration: 60,
    defaultDuration: 45,
    allowedTimeSlots: [15, 30, 45, 60]
  },
  cleaning: {
    minDuration: 45,
    maxDuration: 90,
    defaultDuration: 60,
    allowedTimeSlots: [15, 30, 45, 60, 75, 90]
  },
  filling: {
    minDuration: 30,
    maxDuration: 120,
    defaultDuration: 60,
    allowedTimeSlots: [15, 30, 45, 60, 75, 90, 105, 120]
  },
  extraction: {
    minDuration: 30,
    maxDuration: 90,
    defaultDuration: 45,
    allowedTimeSlots: [15, 30, 45, 60, 75, 90]
  },
  root_canal: {
    minDuration: 60,
    maxDuration: 180,
    defaultDuration: 90,
    allowedTimeSlots: [30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180]
  },
  orthodontics: {
    minDuration: 30,
    maxDuration: 120,
    defaultDuration: 60,
    allowedTimeSlots: [15, 30, 45, 60, 75, 90, 105, 120]
  },
  surgery: {
    minDuration: 60,
    maxDuration: 240,
    defaultDuration: 120,
    allowedTimeSlots: [30, 60, 90, 120, 150, 180, 210, 240]
  },
  emergency: {
    minDuration: 15,
    maxDuration: 120,
    defaultDuration: 30,
    allowedTimeSlots: [15, 30, 45, 60, 75, 90, 105, 120]
  },
  follow_up: {
    minDuration: 15,
    maxDuration: 45,
    defaultDuration: 30,
    allowedTimeSlots: [15, 30, 45]
  }
};

// Días festivos comunes (se pueden personalizar por clínica)
const DEFAULT_HOLIDAYS: Holiday[] = [
  { date: '01-01', name: 'Año Nuevo', isRecurring: true },
  { date: '05-01', name: 'Día del Trabajador', isRecurring: true },
  { date: '07-20', name: 'Día de la Independencia', isRecurring: true },
  { date: '08-10', name: 'Primer Grito de Independencia', isRecurring: true },
  { date: '10-09', name: 'Independencia de Guayaquil', isRecurring: true },
  { date: '11-02', name: 'Día de los Difuntos', isRecurring: true },
  { date: '11-03', name: 'Independencia de Cuenca', isRecurring: true },
  { date: '12-25', name: 'Navidad', isRecurring: true },
];

// =================================================================
// CLASE PRINCIPAL DE VALIDACIONES
// =================================================================

export class AppointmentValidations {
  
  // =================================================================
  // VALIDACIONES DE HORARIOS DE TRABAJO
  // =================================================================

  /**
   * Validar si la fecha y hora están dentro del horario de trabajo
   */
  async validateWorkingHours(
    appointmentDate: string,
    startTime: string,
    endTime: string,
    clinicId: string
  ): Promise<ValidationResult> {
    try {
      const result: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: []
      };

      // Obtener horarios de trabajo de la clínica
      const workingHours = await this.getClinicWorkingHours(clinicId);
      
      // Obtener día de la semana
      const date = new Date(appointmentDate);
      const dayOfWeek = date.getDay();
      
      const daySchedule = workingHours.find(wh => wh.dayOfWeek === dayOfWeek);
      
      if (!daySchedule || !daySchedule.isWorkingDay) {
        result.isValid = false;
        result.errors.push('La clínica no atiende en este día de la semana');
        return result;
      }

      // Validar horarios
      if (!this.isTimeInRange(startTime, daySchedule.startTime, daySchedule.endTime)) {
        result.isValid = false;
        result.errors.push(`La hora de inicio debe estar entre ${daySchedule.startTime} y ${daySchedule.endTime}`);
      }

      if (!this.isTimeInRange(endTime, daySchedule.startTime, daySchedule.endTime)) {
        result.isValid = false;
        result.errors.push(`La hora de fin debe estar entre ${daySchedule.startTime} y ${daySchedule.endTime}`);
      }

      return result;
    } catch (error) {
      logger.error('Error al validar horarios de trabajo', { error, appointmentDate, startTime, endTime });
      return {
        isValid: false,
        errors: ['Error interno al validar horarios de trabajo'],
        warnings: []
      };
    }
  }

  /**
   * Validar si es día festivo
   */
  async validateHolidays(
    appointmentDate: string,
    clinicId: string
  ): Promise<ValidationResult> {
    try {
      const result: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: []
      };

      const holidays = await this.getClinicHolidays(clinicId);
      const date = new Date(appointmentDate);
      const monthDay = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const fullDate = appointmentDate;

      // Verificar días festivos recurrentes
      const recurringHoliday = holidays.find(h => h.isRecurring && h.date === monthDay);
      if (recurringHoliday) {
        result.isValid = false;
        result.errors.push(`No se pueden agendar citas en ${recurringHoliday.name}`);
        return result;
      }

      // Verificar días festivos específicos
      const specificHoliday = holidays.find(h => !h.isRecurring && h.date === fullDate);
      if (specificHoliday) {
        result.isValid = false;
        result.errors.push(`No se pueden agendar citas en ${specificHoliday.name}`);
        return result;
      }

      return result;
    } catch (error) {
      logger.error('Error al validar días festivos', { error, appointmentDate });
      return {
        isValid: true, // En caso de error, permitir la cita
        errors: [],
        warnings: ['No se pudo verificar días festivos']
      };
    }
  }

  // =================================================================
  // VALIDACIONES DE DURACIÓN Y TIPO
  // =================================================================

  /**
   * Validar duración según tipo de cita
   */
  validateAppointmentDuration(
    appointmentType: AppointmentType,
    durationMinutes: number
  ): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    const rules = APPOINTMENT_DURATION_RULES[appointmentType];
    if (!rules) {
      result.warnings.push('Tipo de cita no reconocido, usando validaciones básicas');
      return result;
    }

    // Validar duración mínima y máxima
    if (durationMinutes < rules.minDuration) {
      result.isValid = false;
      result.errors.push(`La duración mínima para ${appointmentType} es ${rules.minDuration} minutos`);
    }

    if (durationMinutes > rules.maxDuration) {
      result.isValid = false;
      result.errors.push(`La duración máxima para ${appointmentType} es ${rules.maxDuration} minutos`);
    }

    // Validar slots de tiempo permitidos
    if (!rules.allowedTimeSlots.includes(durationMinutes)) {
      result.warnings.push(`Se recomienda usar duraciones de: ${rules.allowedTimeSlots.join(', ')} minutos`);
    }

    return result;
  }

  /**
   * Validar que la hora de inicio sea anterior a la de fin
   */
  validateTimeSequence(startTime: string, endTime: string): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);

    if (startMinutes >= endMinutes) {
      result.isValid = false;
      result.errors.push('La hora de inicio debe ser anterior a la hora de fin');
    }

    return result;
  }

  /**
   * Validar que la cita no sea en el pasado
   */
  validateFutureDate(appointmentDate: string, startTime: string): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    const now = new Date();
    const appointmentDateTime = new Date(`${appointmentDate}T${startTime}:00`);

    if (appointmentDateTime <= now) {
      result.isValid = false;
      result.errors.push('No se pueden agendar citas en el pasado');
    }

    // Advertencia si es muy próxima (menos de 2 horas)
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    if (appointmentDateTime <= twoHoursFromNow && appointmentDateTime > now) {
      result.warnings.push('La cita está programada con menos de 2 horas de anticipación');
    }

    return result;
  }

  // =================================================================
  // VALIDACIONES DE DISPONIBILIDAD DEL DENTISTA
  // =================================================================

  /**
   * Validar disponibilidad del dentista
   */
  async validateDentistAvailability(
    dentistId: string,
    appointmentDate: string,
    startTime: string,
    endTime: string,
    clinicId: string,
    excludeAppointmentId?: string
  ): Promise<ValidationResult> {
    try {
      const result: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: []
      };

      // Verificar si el dentista trabaja en esta clínica
      const { data: dentistProfile, error: profileError } = await supabase
        .from('users')
        .select('clinic_id, is_active')
        .eq('id', dentistId)
        .eq('clinic_id', clinicId)
        .single();

      if (profileError || !dentistProfile) {
        result.isValid = false;
        result.errors.push('El dentista no está asociado a esta clínica');
        return result;
      }

      if (!dentistProfile.is_active) {
        result.isValid = false;
        result.errors.push('El dentista no está activo en el sistema');
        return result;
      }

      // Verificar horarios personalizados del dentista (si existen)
      const dentistSchedule = await this.getDentistSchedule(dentistId, appointmentDate);
      if (dentistSchedule && !dentistSchedule.isAvailable) {
        result.isValid = false;
        result.errors.push('El dentista no está disponible en esta fecha');
        return result;
      }

      return result;
    } catch (error) {
      logger.error('Error al validar disponibilidad del dentista', { error, dentistId, appointmentDate });
      return {
        isValid: false,
        errors: ['Error al verificar disponibilidad del dentista'],
        warnings: []
      };
    }
  }

  // =================================================================
  // MÉTODOS AUXILIARES
  // =================================================================

  /**
   * Obtener horarios de trabajo de la clínica
   */
  private async getClinicWorkingHours(clinicId: string): Promise<WorkingHours[]> {
    try {
      const { data, error } = await supabase
        .from('clinic_working_hours')
        .select('*')
        .eq('clinic_id', clinicId);

      if (error || !data || data.length === 0) {
        // Usar horarios por defecto si no hay configuración
        return DEFAULT_WORKING_HOURS;
      }

      return data.map(wh => ({
        dayOfWeek: wh.day_of_week,
        startTime: wh.start_time,
        endTime: wh.end_time,
        isWorkingDay: wh.is_working_day
      }));
    } catch (error) {
      logger.error('Error al obtener horarios de trabajo', { error, clinicId });
      return DEFAULT_WORKING_HOURS;
    }
  }

  /**
   * Obtener días festivos de la clínica
   */
  private async getClinicHolidays(clinicId: string): Promise<Holiday[]> {
    try {
      const { data, error } = await supabase
        .from('clinic_holidays')
        .select('*')
        .eq('clinic_id', clinicId);

      if (error || !data) {
        return DEFAULT_HOLIDAYS;
      }

      const customHolidays = data.map(h => ({
        date: h.holiday_date,
        name: h.name,
        isRecurring: h.is_recurring
      }));

      // Combinar días festivos por defecto con personalizados
      return [...DEFAULT_HOLIDAYS, ...customHolidays];
    } catch (error) {
      logger.error('Error al obtener días festivos', { error, clinicId });
      return DEFAULT_HOLIDAYS;
    }
  }

  /**
   * Obtener horario específico del dentista
   */
  private async getDentistSchedule(dentistId: string, date: string): Promise<{ isAvailable: boolean } | null> {
    try {
      const { data, error } = await supabase
        .from('dentist_schedules')
        .select('is_available')
        .eq('dentist_id', dentistId)
        .eq('date', date)
        .single();

      if (error || !data) {
        return null; // No hay horario específico, usar horario general
      }

      return { isAvailable: data.is_available };
    } catch (error) {
      logger.error('Error al obtener horario del dentista', { error, dentistId, date });
      return null;
    }
  }

  /**
   * Verificar si una hora está en un rango
   */
  private isTimeInRange(time: string, startTime: string, endTime: string): boolean {
    const timeMinutes = this.timeToMinutes(time);
    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);

    return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
  }

  /**
   * Convertir hora a minutos
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  }

  /**
   * Validación completa de cita
   */
  async validateCompleteAppointment(
    appointmentData: {
      appointment_date: string;
      start_time: string;
      end_time: string;
      duration_minutes: number;
      appointment_type: AppointmentType;
      dentist_id: string;
      patient_id: string;
    },
    clinicId: string,
    excludeAppointmentId?: string
  ): Promise<ValidationResult> {
    const allResults: ValidationResult[] = [];

    // Ejecutar todas las validaciones
    allResults.push(this.validateTimeSequence(appointmentData.start_time, appointmentData.end_time));
    allResults.push(this.validateFutureDate(appointmentData.appointment_date, appointmentData.start_time));
    allResults.push(this.validateAppointmentDuration(appointmentData.appointment_type, appointmentData.duration_minutes));
    
    allResults.push(await this.validateWorkingHours(
      appointmentData.appointment_date,
      appointmentData.start_time,
      appointmentData.end_time,
      clinicId
    ));
    
    allResults.push(await this.validateHolidays(appointmentData.appointment_date, clinicId));
    
    allResults.push(await this.validateDentistAvailability(
      appointmentData.dentist_id,
      appointmentData.appointment_date,
      appointmentData.start_time,
      appointmentData.end_time,
      clinicId,
      excludeAppointmentId
    ));

    // Combinar resultados
    const combinedResult: ValidationResult = {
      isValid: allResults.every(r => r.isValid),
      errors: allResults.flatMap(r => r.errors),
      warnings: allResults.flatMap(r => r.warnings)
    };

    return combinedResult;
  }
}

// =================================================================
// INSTANCIA SINGLETON
// =================================================================

export const appointmentValidations = new AppointmentValidations();