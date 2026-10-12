import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../lib/socket';
import { api } from '../lib/api';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Truck, MapPin, Navigation, Package, Crosshair } from 'lucide-react';
import { Delivery } from '../types';

function MapRecenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
}

export default function DriverDashboard() {
  const { user } = useAuth();
  const [isTracking, setIsTracking] = useState(false);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [routePositions, setRoutePositions] = useState<[number, number][]>([]);

  const loadDeliveries = useCallback(async () => {
    try {
      // Pedir lista de pedidos pendiente para este conductor
      const res = await api<Delivery[]>('/deliveries');
      // Filtrar los asignados a él (driver_id === user.id) y que no estén entregados
      let myDeliveries = res.filter(d => 
        d.driver_id === user?.id && 
        d.status !== 'entregado' && 
        d.status !== 'fallido'
      );
      
      // MOCK DATA: Si no hay entregas, mostrar unas de prueba para que el usuario pueda visualizar el mapa OSRM
      if (myDeliveries.length === 0) {
        myDeliveries = [
          {
            id: 9991,
            order_id: 801,
            order_code: 'MOCK-801',
            driver_id: user?.id || 0,
            status: 'en_camino',
            restaurant_name: 'Restaurante Prueba (Bucaramanga Centro)',
            delivery_address: 'Cra 27 # 36-14',
            dest_lat: 7.1193,
            dest_lng: -73.1227,
            assigned_at: new Date().toISOString()
          } as unknown as Delivery,
          {
            id: 9992,
            order_id: 802,
            order_code: 'MOCK-802',
            driver_id: user?.id || 0,
            status: 'asignado',
            restaurant_name: 'Pizzería Cabecera',
            delivery_address: 'Cra 33 # 48-12',
            dest_lat: 7.1141,
            dest_lng: -73.1098,
            assigned_at: new Date().toISOString()
          } as unknown as Delivery
        ];
      }

      setDeliveries(myDeliveries);
      if (myDeliveries.length > 0 && !selectedDelivery) {
        setSelectedDelivery(myDeliveries[0]);
      }
    } catch (err) {
      console.error(err);
    }
  }, [user, selectedDelivery]);

  useEffect(() => {
    loadDeliveries();
  }, [loadDeliveries]);

  // Fetch initial position by IP
  useEffect(() => {
    const fetchIpLocation = async () => {
      try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        if (data && data.latitude && data.longitude && !position) {
          setPosition({ lat: data.latitude, lng: data.longitude });
        } else if (!position) {
          setPosition({ lat: 7.1139, lng: -73.1198 }); // Bucaramanga fallback
        }
      } catch (err) {
        console.warn('IP Location failed', err);
        if (!position) setPosition({ lat: 7.1139, lng: -73.1198 });
      }
    };
    fetchIpLocation();
    
    // Also try exact geolocation right away
    if (navigator.geolocation && !position) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }, () => {}, { enableHighAccuracy: true });
    }
    
    // Cleanup watch on unmount
    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Fetch OSRM Route
  useEffect(() => {
    if (!position || !selectedDelivery) return;
    
    const fetchRoute = async () => {
      const destLat = Number(selectedDelivery.dest_lat) || 7.1193;
      const destLng = Number(selectedDelivery.dest_lng) || -73.1227;
      
      try {
        // OSRM coordinates are in [lng, lat]
        const url = `https://router.project-osrm.org/route/v1/driving/${position.lng},${position.lat};${destLng},${destLat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const coords = data.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number]);
          setRoutePositions(coords);
        }
      } catch (err) {
        console.error('OSRM fetch error', err);
      }
    };
    
    fetchRoute();
  }, [position?.lat, position?.lng, selectedDelivery]);

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
          const newSpeed = pos.coords.speed; // m/s
          setPosition(newPos);
          setSpeed(newSpeed);

          const socket = getSocket();
          if (socket && selectedDelivery) {
            socket.emit('delivery:update_position', {
              deliveryId: selectedDelivery.id,
              lat: newPos.lat,
              lng: newPos.lng,
              speed: newSpeed,
              accuracy: pos.coords.accuracy,
              heading: pos.coords.heading
            });
          }
        },
        (err) => {
          alert("Error GPS: " + err.message);
        },
        { enableHighAccuracy: true, maximumAge: 0 }
      );
      
      setWatchId(id);
      setIsTracking(true);
    }
  };

  const mapCenter: [number, number] = position ? [position.lat, position.lng] : [7.1193, -73.1227];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-brand/10 text-brand rounded-2xl flex items-center justify-center shrink-0">
            <Truck className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">Panel de Domiciliario</h1>
            <p className="text-sm text-slate-500">Navegación inteligente con tecnología OSRM</p>
          </div>
        </div>
        
        <button
          onClick={toggleTracking}
          className={`px-6 py-3 rounded-xl font-bold text-sm shadow-lg flex items-center gap-2 transition-all shrink-0 ${
            isTracking 
              ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/30' 
              : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/30'
          }`}
        >
          <Navigation className={`w-5 h-5 ${!isTracking ? 'animate-bounce' : ''}`} />
          {isTracking ? 'Detener Transmisión GPS' : 'Iniciar Navegación GPS'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar: Lista de pedidos */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Package className="w-5 h-5 text-brand" /> Pedidos Pendientes ({deliveries.length})
          </h2>
          
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {deliveries.length === 0 && (
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
                <p className="text-sm text-slate-500 font-medium">No tienes entregas asignadas en este momento.</p>
              </div>
            )}
            
            {deliveries.map(d => (
              <div 
                key={d.id} 
                onClick={() => setSelectedDelivery(d)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  selectedDelivery?.id === d.id 
                    ? 'bg-brand/5 border-brand shadow-sm shadow-brand/10' 
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded">
                    #{d.order_code || d.order_id}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    {d.status}
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">{d.restaurant_name}</h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{d.delivery_address}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Map Area */}
        <div className="lg:col-span-2 relative h-[500px] rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-slate-100">
          <MapContainer center={mapCenter} zoom={15} className="w-full h-full relative z-0">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapRecenter center={mapCenter} />
            
            {/* Ruta OSRM */}
            {routePositions.length > 0 && (
              <Polyline positions={routePositions} pathOptions={{ color: '#2563eb', weight: 6, opacity: 0.8 }} />
            )}

            {/* Posición del Domiciliario */}
            {position && (
              <CircleMarker 
                center={[position.lat, position.lng]} 
                radius={10} 
                pathOptions={{ color: 'white', weight: 3, fillColor: '#3b82f6', fillOpacity: 1 }}
              >
                <Popup>Mi Ubicación Actual</Popup>
              </CircleMarker>
            )}

            {/* Posición del Destino */}
            {selectedDelivery && Number(selectedDelivery.dest_lat) && Number(selectedDelivery.dest_lng) && (
              <CircleMarker 
                center={[Number(selectedDelivery.dest_lat), Number(selectedDelivery.dest_lng)]} 
                radius={10} 
                pathOptions={{ color: 'white', weight: 3, fillColor: '#10b981', fillOpacity: 1 }}
              >
                <Popup>Destino: {selectedDelivery.restaurant_name}</Popup>
              </CircleMarker>
            )}
            
            {/* Botón mi ubicación */}
            <div className="absolute top-4 right-4 z-[400] flex flex-col gap-2">
              <button 
                onClick={(e) => { 
                  e.preventDefault(); 
                  e.stopPropagation(); 
                  if (position && navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(pos => setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude })); 
                  }
                }}
                className="bg-white text-slate-700 p-2.5 rounded-xl shadow-lg border border-slate-200 hover:bg-slate-50"
                title="Centrar en mi ubicación"
              >
                <Crosshair className="w-5 h-5" />
              </button>
            </div>
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
