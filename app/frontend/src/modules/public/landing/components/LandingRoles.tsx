import { Link } from 'react-router-dom';
import { rolesData } from '../landingData';
import type { LandingInteractions } from '../hooks';

type Props = Pick<LandingInteractions, 'activeRole' | 'setActiveRole'>;

export function LandingRoles({ activeRole, setActiveRole }: Props) {
  return (
    <>
        {/* Roles Section */}
        <section id="roles">
          <div className="sec-head">
            <h2>Una experiencia dedicada para cada rol</h2>
            <p className="sub">
              Consolas especializadas para cada usuario dentro de la cadena de suministro.
            </p>
          </div>

          {/* Role Tabs */}
          <div className="role-tabs">
            {rolesData.map(role => (
              <button
                key={role.key}
                className={'role-tab-btn' + (activeRole === role.key ? ' active' : '')}
                onClick={() => setActiveRole(role.key)}
              >
                <span>{role.name}</span>
              </button>
            ))}
          </div>

          {/* Role Panels */}
          <div className="glass roles-glass">
            {rolesData.map(role => (
              <div
                key={role.key}
                className={'role-panel' + (activeRole === role.key ? ' active' : '')}
              >
                <div className="role-info">
                  <h3>{role.name}</h3>
                  <p>{role.summary}</p>
                  <ul className="role-highlights">
                    {role.highlights.map((item, idx) => (
                      <li key={idx}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Link className="btn sm" to="/register">
                    <span>Probar vista de {role.name}</span>
                  </Link>
                </div>

                <div className="mockup-preview">
                  <div className="mockup-header">
                    <div className="mockup-dots">
                      <span />
                      <span />
                      <span />
                    </div>
                    <div className="mockup-title">{role.mockupData.title}</div>
                  </div>

                  <div className="mockup-metrics">
                    {role.mockupData.metrics.map((m, idx) => (
                      <div key={idx} className="m-metric">
                        <span>{m.label}</span>
                        <b>{m.val}</b>
                      </div>
                    ))}
                  </div>

                  <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid var(--line)', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                      Acción principal en consola:
                    </span>
                    <button className="btn sm ghost" style={{ width: '100%' }}>
                      {role.mockupData.actionText}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
    </>
  );
}
