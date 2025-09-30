import * as winston from 'winston';
import DailyRotateFile = require('winston-daily-rotate-file');
import * as path from 'path';

// Configuración de colores para la consola.
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue',
    verbose: 'cyan',
}

winston.addColors(colors);

// Formato personalizado para logs.
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
);

// Formato para consola con colores.
const consoleFormat = winston.format.combine(
    winston.format.colorize({ all: true }),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, stack, message }) => {
        return `${timestamp} [${level}]: ${stack || message}`;
    })
);

// Configuración de transporte para archivos con rotación diaria (solo en desarrollo)
const fileRotateTransport = new DailyRotateFile({
    filename: path.join('logs', 'application-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: logFormat,
});

// Configuración de transporte para errores (solo en desarrollo)
const errorFileTransport = new DailyRotateFile({
    filename: path.join('logs', 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '20m',
    maxFiles: '30d',
    format: logFormat
});

// Función para obtener los transportes según el entorno
const getTransports = () => {
    const transports: winston.transport[] = [];
    
    // Consola siempre disponible
    transports.push(new winston.transports.Console({ 
        format: process.env.NODE_ENV === 'production' ? logFormat : consoleFormat 
    }));
    
    // Archivos solo en desarrollo (no en Vercel/producción)
    if (process.env.NODE_ENV !== 'production') {
        transports.push(fileRotateTransport);
        transports.push(errorFileTransport);
    }
    
    return transports;
};

// Función para obtener los manejadores de excepciones según el entorno
const getExceptionHandlers = () => {
    const handlers: winston.transport[] = [];
    
    // Consola siempre disponible para excepciones
    handlers.push(new winston.transports.Console({ format: logFormat }));
    
    // Archivo solo en desarrollo
    if (process.env.NODE_ENV !== 'production') {
        handlers.push(new winston.transports.File({
            filename: path.join('logs', 'exceptions.log')
        }));
    }
    
    return handlers;
};

// Función para obtener los manejadores de rechazos según el entorno
const getRejectionHandlers = () => {
    const handlers: winston.transport[] = [];
    
    // Consola siempre disponible para rechazos
    handlers.push(new winston.transports.Console({ format: logFormat }));
    
    // Archivo solo en desarrollo
    if (process.env.NODE_ENV !== 'production') {
        handlers.push(new winston.transports.File({
            filename: path.join('logs', 'rejections.log')
        }));
    }
    
    return handlers;
};

// Crear el logger principal
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    transports: getTransports(),
    exceptionHandlers: getExceptionHandlers(),
    rejectionHandlers: getRejectionHandlers()
})

export default logger;