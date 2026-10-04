import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { connectSocket, getSocket } from '../lib/socket';
import { Truck, MapPin, Navigation, Zap } from 'lucide-react';

export default function DriverDashboard() {
  const { user } = useAuth();
  const [isTracking, setIsTracking] = useState(false);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [speed, setSpeed] = useState<number | null>(null); // m/s
  const [watchId, setWatchId] = useState<number | null>(null);
  
  // Asumimos un ID de entrega hardcodeado para la prueba, en producción esto vendría de los pedidos asignados.
  const TEST_DELIVERY_ID = 1;

  useEffect(() => {
    // Conectar el socket del repartidor
    connectSocket({ userId: user?.id });
    
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [user, watchId]);

  const toggleTracking = () => {
    if (isTracking) {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        setWatchId(null);
      }
      setIsTracking(false);
      setSpeed(0);
    } else {
      if (!navigator.geolocation) {
        alert("Tu dispositivo no soporta Geolocalización");
        return;
      }
      
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          const newSpeed = pos.coords.speed; // en metros por segundo
          
          setPosition(newPos);
          setSpeed(newSpeed);

          const socket = getSocket();
          if (socket) {
            // Enviamos la posición en vivo al backend
            socket.emit('delivery:update_position', {
              deliveryId: TEST_DELIVERY_ID,
              lat: newPos.lat,
              lng: newPos.lng,
              speed: newSpeed
            });
          }
        },
        (err) => {
          console.error("Error obteniendo ubicación:", err);
          alert("Error de GPS: " + err.message);
        },
        { enableHighAccuracy: true, maximumAge: 0 }
      );
      
      setWatchId(id);
      setIsTracking(true);
    }
  };

  const speedKmH = speed ? (speed * 3.6).toFixed(1) : "0.0";

  return (
    <div className="max-w-md mx-auto h-full flex flex-col items-center justify-center p-6 bg-slate-900 rounded-3xl text-white shadow-2xl border border-slate-800 mt-10">
      <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
        <Truck className="w-8 h-8 text-amber-500" />
      </div>
      
      <h1 className="text-2xl font-bold mb-1">Modo Repartidor</h1>
      <p className="text-slate-400 text-sm mb-8">Conectado como {user?.name}</p>

      <div className="w-full bg-slate-800 rounded-2xl p-6 mb-8 relative overflow-hidden">
        {isTracking && (
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-sky-500 to-emerald-500 animate-pulse" />
        )}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center text-slate-400 mb-2 gap-1 text-xs uppercase font-bold tracking-wider">
              <Zap className="w-4 h-4 text-sky-400" /> Velocidad
            </div>
            <p className="text-3xl font-bold text-white">
              {speedKmH} <span className="text-sm font-normal text-slate-500">km/h</span>
            </p>
          </div>
          
          <div className="text-center border-l border-slate-700">
            <div className="flex items-center justify-center text-slate-400 mb-2 gap-1 text-xs uppercase font-bold tracking-wider">
              <MapPin className="w-4 h-4 text-emerald-400" /> Estado GPS
            </div>
            {isTracking ? (
              <p className="text-emerald-400 font-bold flex items-center justify-center gap-2 mt-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                Transmitiendo
              </p>
            ) : (
              <p className="text-slate-500 font-medium mt-2">Inactivo</p>
            )}
          </div>
        </div>

        {position && (
          <div className="mt-6 pt-4 border-t border-slate-700 text-center">
            <p className="text-xs text-slate-500 font-mono">
              LAT: {position.lat.toFixed(5)} <br/> LNG: {position.lng.toFixed(5)}
            </p>
          </div>
        )}
      </div>

      <button
        onClick={toggleTracking}
        className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${
          isTracking 
            ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-[0_0_20px_rgba(244,63,94,0.4)]' 
            : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]'
        }`}
      >
        <Navigation className={`w-6 h-6 ${isTracking ? '' : 'animate-bounce'}`} />
        {isTracking ? 'Finalizar Viaje' : 'Iniciar Viaje y Transmitir GPS'}
      </button>

      <p className="text-xs text-slate-500 mt-6 text-center">
        El GPS se transmite en vivo a la plataforma a través de Socket.io
      </p>
    </div>
  );
}
