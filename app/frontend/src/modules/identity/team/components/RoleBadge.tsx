export default function RoleBadge({ roleId, roleName }: { roleId: number; roleName: string }) {
  if (roleId === 5 || roleName === 'domiciliario') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-bold text-sky-800 border border-sky-200 shadow-xs">
        <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
        <span>Domiciliario</span>
      </span>
    );
  }
  if (roleId === 2 || roleName === 'gerente') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-800 border border-purple-200">
        <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
        <span>Gerente</span>
      </span>
    );
  }
  if (roleId === 4 || roleName === 'proveedor_admin') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800 border border-blue-200">
        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
        <span>Proveedor Admin</span>
      </span>
    );
  }
  if (roleId === 1 || roleName === 'admin') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 border border-amber-200">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        <span>Administrador</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 border border-slate-200">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      <span>Empleado</span>
    </span>
  );
}
