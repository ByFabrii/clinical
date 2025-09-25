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

// Configuración de transporte para archivos con rotación diaria
const fileRotateTransport = new DailyRotateFile({
    filename: path.join('logs', 'application-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: logFormat,
});

// Configuración de transporte para errores
const errorFileTransport = new DailyRotateFile({
    filename: path.join('logs', 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '20m',
    maxFiles: '30d',
    format: logFormat
});

// Crear el logger principal
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    transports: [
        // Consola solo para desarrollo.
        ...(process.env.NODE_ENV !== 'production' ? [new winston.transports.Console({ format: consoleFormat })] : []),

        // Archivos
        fileRotateTransport,
        errorFileTransport,
    ],

    // Manejo de excepciones no capturadas.
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join('logs', 'exceptions.log')
        })
    ],

    // Manejo de rechazos de promesas no capturadas
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join('logs', 'rejections.log')
        })
    ]
})

export default logger;