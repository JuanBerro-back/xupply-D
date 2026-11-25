import { Request, Response, NextFunction } from 'express';
import { fetchCategories } from './categories.repository';

export async function listCategories(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await fetchCategories();
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}
