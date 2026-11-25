// ConfiguraciÃ³n de planes del asistente IA.
export const PLAN_SELECT: Record<string, { model: string; assistant: boolean; reports: boolean }> = {
  basico: { model: 'xupply-lite', assistant: true, reports: false },
  medio: { model: 'xupply-pro', assistant: true, reports: true },
  premium: { model: 'xupply-max', assistant: true, reports: true },
};
