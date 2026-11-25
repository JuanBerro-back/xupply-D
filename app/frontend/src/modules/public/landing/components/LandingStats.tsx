import type { LandingInteractions } from '../hooks';

type Props = Pick<LandingInteractions, 'handleCardMouseMove' | 'handleCardMouseLeave'>;

export function LandingStats({ handleCardMouseMove, handleCardMouseLeave }: Props) {
  return (
    <>
        {/* KPI Stats Section */}
        <section>
          <div className="stats">
            <div className="glass tilt stat-card" onMouseMove={handleCardMouseMove} onMouseLeave={handleCardMouseLeave}>
              <b className="gt">5</b>
              <span>Roles con permisos configurables</span>
            </div>
            <div className="glass tilt stat-card" onMouseMove={handleCardMouseMove} onMouseLeave={handleCardMouseLeave}>
              <b className="gt">99.8%</b>
              <span>Entregas a tiempo con ruta optimizada</span>
            </div>
            <div className="glass tilt stat-card" onMouseMove={handleCardMouseMove} onMouseLeave={handleCardMouseLeave}>
              <b className="gt">100%</b>
              <span>Cumplimiento normativo DIAN y CUFE</span>
            </div>
            <div className="glass tilt stat-card" onMouseMove={handleCardMouseMove} onMouseLeave={handleCardMouseLeave}>
              <b className="gt">0%</b>
              <span>Mermas por vencimiento con FEFO</span>
            </div>
          </div>
        </section>
    </>
  );
}
