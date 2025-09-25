import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        // Permite usar funciones globales como describe, test, expect sin importarlas.
        globals: true,
        // Entorno Node.js para testing de backend
        environment: 'node',
        /// Archivo de configuración que se ejecuta antes de cada test
        setupFiles: ['./src/test/setup.ts'],
        
        // Aumentar tiempo de ejecución para tests e2e
        testTimeout: 30000,
        hookTimeout: 30000,
        // Configuración del coverage
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/',
                'dist/',
                'coverage/',
                '**/*.d.ts',
                '**/*.config.ts'
            ]
        }
    },

    // Configurar path aliases (igual que en tsconfig.json)
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@config': path.resolve(__dirname, './src/config'),
            '@controllers': path.resolve(__dirname, './src/controllers'),
            '@middleware': path.resolve(__dirname, './src/middleware'),
            '@routes': path.resolve(__dirname, './src/routes'),
            '@services': path.resolve(__dirname, './src/services'),
            '@schemas': path.resolve(__dirname, './src/schemas'),
            '@types': path.resolve(__dirname, './src/types'),
            '@utils': path.resolve(__dirname, './src/utils')
        }
    }
})