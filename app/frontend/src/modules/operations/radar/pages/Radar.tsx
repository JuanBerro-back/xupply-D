import { useRadar } from '../hooks';
import { SupplierRadarView } from '../components/SupplierRadarView';
import { RestaurantRadarView } from '../components/RestaurantRadarView';

export default function Radar() {
  const radar = useRadar();

  if (radar.isSupplier) return <SupplierRadarView {...radar} />;
  return <RestaurantRadarView {...radar} />;
}
