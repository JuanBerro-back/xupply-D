import { Router } from 'express';
import express from 'express';
import { authRequired, requirePermission } from '../../../shared/middleware/auth';
import { publicLimiter, uploadLimiter } from './verification.service';
import { getPublicRequest, uploadDocument, submitCorrection, summary, requests, requestDetail, getDocument, decision, addNote } from './verification.controller';

const router = Router();

router.get('/public/:token', publicLimiter, getPublicRequest);

router.post(
  '/public/:token/documents',
  uploadLimiter,
  express.json({ limit: '6mb' }),
  uploadDocument
);

router.post('/public/:token/submit', publicLimiter, submitCorrection);

/* ------------------------------------------------------------------ */
/* Reenvío tras una corrección solicitada                              */
/* ------------------------------------------------------------------ */

router.use(authRequired, requirePermission('verificacion'));

router.get('/summary', summary);
router.get('/requests', requests);
router.get('/requests/:type/:id', requestDetail);
router.get('/requests/:type/:id/documents/:docType', getDocument);
router.post('/requests/:type/:id/decision', requirePermission('verificacion:write'), decision);
router.post('/requests/:type/:id/notes', requirePermission('verificacion:write'), addNote);

export default router;
