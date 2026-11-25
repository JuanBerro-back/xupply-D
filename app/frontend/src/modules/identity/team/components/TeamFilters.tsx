import { IconClose } from '../../../../shared/ui/Icons';
import { TeamUser } from '../types';

export default function TeamFilters({
  activeTab,
  onTabChange,
  users,
  searchQuery,
  onSearchChange,
}: {
  activeTab: 'todos' | 'activos' | 'inactivos';
  onTabChange: (tab: 'todos' | 'activos' | 'inactivos') => void;
  users: TeamUser[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
      {/* Pestañas Segmentadas */}
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
        <button
          onClick={() => onTabChange('todos')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            activeTab === 'todos'
              ? 'bg-white text-brand shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Todos ({users.length})
        </button>
        <button
          onClick={() => onTabChange('activos')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
            activeTab === 'activos'
              ? 'bg-white text-emerald-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>Activos</span>
          <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[10px] text-emerald-800 font-black">
            {users.filter(u => u.is_active).length}
          </span>
        </button>
        <button
          onClick={() => onTabChange('inactivos')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
            activeTab === 'inactivos'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Inactivos ({users.filter(u => !u.is_active).length})
        </button>
      </div>

      {/* Campo de Búsqueda Rápida */}
      <div className="relative w-full sm:w-64">
        <input
          type="text"
          placeholder="Buscar por nombre, usuario, tel..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            aria-label="Limpiar búsqueda"
          >
            <IconClose className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
