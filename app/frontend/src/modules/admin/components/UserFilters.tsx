import { Role } from '../types';

export default function UserFilters({
  search,
  onSearchChange,
  filterRole,
  onFilterRoleChange,
  roles,
  filterActive,
  onFilterActiveChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  filterRole: string;
  onFilterRoleChange: (value: string) => void;
  roles: Role[];
  filterActive: string;
  onFilterActiveChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <input
        type="text"
        placeholder="Buscar nombre, usuario..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 dark:text-white"
      />
      <select
        value={filterRole}
        onChange={(e) => onFilterRoleChange(e.target.value)}
        className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 dark:text-white"
      >
        <option value="">Cualquier Rol</option>
        {roles.map(r => <option key={r.id} value={r.id}>{r.display_name}</option>)}
      </select>
      <select
        value={filterActive}
        onChange={(e) => onFilterActiveChange(e.target.value)}
        className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 dark:text-white"
      >
        <option value="">Cualquier Estado</option>
        <option value="true">Activos</option>
        <option value="false">Inactivos</option>
      </select>
    </div>
  );
}
