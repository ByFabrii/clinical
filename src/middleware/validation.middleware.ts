import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

function validateSchema<T extends z.ZodSchema>(
    schema: T,
    source: 'body' | 'query' | 'params' = 'body'
) {
    return (req: Request, res: Response, next: NextFunction): void | Response => {
        try {
            const result = schema.safeParse(req[source])

            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: result.error.issues.map(issue => ({
                        field: issue.path.join('.'),
                        message: issue.message,
                        code: issue.code
                    }))
                })
            }

            // Reemplazar datos originales con datos validados/transformados
            (req as any)[source] = result.data
            next()
        } catch (error) {
            res.status(500).json({ 
                success: false,
                message: 'Internal validation error' 
            })
        }
    }
}

export { validateSchema }