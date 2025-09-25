// =================================================================
// TIPOS PARA SISTEMA DE NOTIFICACIONES Y RECORDATORIOS
// Sistema de Expedientes Clínicos Dentales
// =================================================================

export enum NotificationType {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
  IN_APP = 'IN_APP'
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export enum ReminderType {
  APPOINTMENT_REMINDER = 'APPOINTMENT_REMINDER',
  APPOINTMENT_CONFIRMATION = 'APPOINTMENT_CONFIRMATION',
  FOLLOW_UP = 'FOLLOW_UP',
  PAYMENT_REMINDER = 'PAYMENT_REMINDER',
  BIRTHDAY = 'BIRTHDAY'
}

export interface NotificationTemplate {
  id: string;
  name: string;
  type: ReminderType;
  subject: string;
  body: string;
  variables: string[]; // Variables que se pueden usar en el template
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationConfig {
  id: string;
  clinicId: string;
  type: NotificationType;
  isEnabled: boolean;
  settings: {
    // Para EMAIL
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPassword?: string;
    fromEmail?: string;
    fromName?: string;
    
    // Para SMS
    smsProvider?: 'twilio' | 'nexmo' | 'custom';
    apiKey?: string;
    apiSecret?: string;
    fromNumber?: string;
    
    // Para PUSH
    fcmServerKey?: string;
    vapidPublicKey?: string;
    vapidPrivateKey?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationRequest {
  id: string;
  clinicId: string;
  type: NotificationType;
  reminderType: ReminderType;
  recipientId: string; // patient_id o user_id
  recipientType: 'patient' | 'user';
  recipientEmail?: string;
  recipientPhone?: string;
  subject: string;
  body: string;
  scheduledFor: Date;
  status: NotificationStatus;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: Date;
  sentAt?: Date;
  errorMessage?: string;
  metadata: {
    appointmentId?: string;
    patientId?: string;
    dentistId?: string;
    templateId?: string;
    variables?: Record<string, any>;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ReminderSchedule {
  id: string;
  appointmentId: string;
  clinicId: string;
  patientId: string;
  dentistId: string;
  appointmentDate: Date;
  reminderDate: Date;
  type: ReminderType;
  notificationTypes: NotificationType[];
  status: 'SCHEDULED' | 'SENT' | 'CANCELLED';
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreferences {
  id: string;
  userId?: string;
  patientId?: string;
  clinicId: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  reminderTypes: {
    appointmentReminder: boolean;
    appointmentConfirmation: boolean;
    followUp: boolean;
    paymentReminder: boolean;
    birthday: boolean;
  };
  reminderTiming: {
    appointmentReminder: number; // horas antes
    appointmentConfirmation: number; // horas antes
    followUp: number; // días después
  };
  createdAt: Date;
  updatedAt: Date;
}

// =================================================================
// INTERFACES PARA SERVICIOS DE NOTIFICACIÓN
// =================================================================

export interface EmailProvider {
  sendEmail(to: string, subject: string, body: string, isHtml?: boolean): Promise<boolean>;
  validateConfig(config: any): boolean;
}

export interface SMSProvider {
  sendSMS(to: string, message: string): Promise<boolean>;
  validateConfig(config: any): boolean;
}

export interface PushProvider {
  sendPush(token: string, title: string, body: string, data?: any): Promise<boolean>;
  validateConfig(config: any): boolean;
}

// =================================================================
// TIPOS PARA TEMPLATES Y VARIABLES
// =================================================================

export interface TemplateVariable {
  name: string;
  description: string;
  example: string;
  required: boolean;
}

export interface TemplateContext {
  patient: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  dentist: {
    firstName: string;
    lastName: string;
    title?: string;
  };
  clinic: {
    name: string;
    phone: string;
    email: string;
    address: string;
  };
  appointment: {
    id: string;
    date: string;
    time: string;
    duration: number;
    treatmentType: string;
    notes?: string;
  };
  reminder: {
    type: ReminderType;
    scheduledFor: Date;
  };
}

// =================================================================
// RESPUESTAS DE API
// =================================================================

export interface NotificationResponse {
  success: boolean;
  message: string;
  data?: {
    notificationId: string;
    status: NotificationStatus;
    sentAt?: Date;
  };
  error?: string;
}

export interface ReminderResponse {
  success: boolean;
  message: string;
  data?: {
    reminderId: string;
    scheduledFor: Date;
    notificationTypes: NotificationType[];
  };
  error?: string;
}

// =================================================================
// CONFIGURACIONES POR DEFECTO
// =================================================================

export const DEFAULT_REMINDER_TIMING = {
  appointmentReminder: 24, // 24 horas antes
  appointmentConfirmation: 2, // 2 horas antes
  followUp: 1 // 1 día después
};

export const DEFAULT_NOTIFICATION_PREFERENCES = {
  emailEnabled: true,
  smsEnabled: false,
  pushEnabled: true,
  reminderTypes: {
    appointmentReminder: true,
    appointmentConfirmation: true,
    followUp: false,
    paymentReminder: false,
    birthday: false
  },
  reminderTiming: DEFAULT_REMINDER_TIMING
};

// =================================================================
// TEMPLATES POR DEFECTO
// =================================================================

export const DEFAULT_TEMPLATES = {
  APPOINTMENT_REMINDER: {
    subject: 'Recordatorio de Cita - {{clinic.name}}',
    body: `Hola {{patient.firstName}},

Te recordamos que tienes una cita programada:

📅 Fecha: {{appointment.date}}
🕐 Hora: {{appointment.time}}
👨‍⚕️ Doctor: {{dentist.firstName}} {{dentist.lastName}}
🏥 Clínica: {{clinic.name}}

Por favor confirma tu asistencia.

Saludos,
Equipo de {{clinic.name}}
📞 {{clinic.phone}}`
  },
  APPOINTMENT_CONFIRMATION: {
    subject: 'Confirma tu Cita - {{clinic.name}}',
    body: `Hola {{patient.firstName}},

Tu cita es en {{appointment.time}}. Por favor confirma tu asistencia.

📍 {{clinic.address}}
📞 {{clinic.phone}}

Gracias,
{{clinic.name}}`
  },
  FOLLOW_UP: {
    subject: 'Seguimiento de tu Tratamiento - {{clinic.name}}',
    body: `Hola {{patient.firstName}},

¿Cómo te sientes después de tu tratamiento?

Si tienes alguna molestia o pregunta, no dudes en contactarnos.

Saludos,
Dr. {{dentist.firstName}} {{dentist.lastName}}
{{clinic.name}}
📞 {{clinic.phone}}`
  }
};