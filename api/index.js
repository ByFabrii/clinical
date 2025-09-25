"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.default = handler;
const app_1 = require("../src/app");
const logger_1 = __importDefault(require("../src/config/logger"));
let cachedApp = null;
async function handler(req, res) {
    try {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
        res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
        if (req.method === 'OPTIONS') {
            res.status(200).end();
            return;
        }
        if (!cachedApp) {
            logger_1.default.info('Inicializando aplicación para Vercel Functions', {
                action: 'vercel_init',
                timestamp: new Date().toISOString(),
                coldStart: true
            });
            cachedApp = await (0, app_1.initializeApp)();
            logger_1.default.info('Aplicación inicializada exitosamente', {
                action: 'vercel_init_success',
                timestamp: new Date().toISOString()
            });
        }
        return cachedApp(req, res);
    }
    catch (error) {
        logger_1.default.error('Error en Vercel Function', {
            action: 'vercel_error',
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            method: req.method,
            url: req.url,
            timestamp: new Date().toISOString()
        });
        res.status(500).json({
            success: false,
            error: {
                code: 'SERVERLESS_ERROR',
                message: 'Error interno del servidor',
                timestamp: new Date().toISOString()
            }
        });
    }
}
exports.config = {
    runtime: 'nodejs18.x',
    regions: ['iad1'],
    memory: 1024,
    maxDuration: 10
};
