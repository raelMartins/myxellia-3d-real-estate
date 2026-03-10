import type { Database } from './database.types';
import { formatCentsToCurrency } from './currency';

type UnitRow = Database['public']['Tables']['units']['Row'];
type UnitForDetail = Pick<UnitRow, 'status' | 'bedrooms' | 'bathrooms' | 'area_sqm' | 'floor' | 'price'>;
type BuildingWithPrice = { starting_price?: string | null };

export function computeBuildingDetailStats(
    units: UnitForDetail[],
    bldg: BuildingWithPrice
): {
    totalUnits: number;
    availUnits: number;
    availPct: number;
    floorsValue: string;
    bedroomsValue: string;
    bathroomsValue: string;
    areaValue: string;
    startingPriceDisplay: string;
} {
    const totalUnits = units.length;
    const availUnits = units.filter((u) => u.status === 'available').length;
    const availPct = totalUnits > 0 ? Math.round((availUnits / totalUnits) * 100) : 0;

    const beds = units.map((u) => u.bedrooms).filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
    const baths = units.map((u) => u.bathrooms).filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
    const areas = units.map((u) => u.area_sqm).filter((n): n is number => typeof n === 'number' && Number.isFinite(n));

    const floorsValue = units.length > 0 ? String(Math.max(...units.map((u) => u.floor))) : '—';
    const bedroomsValue = beds.length > 0 ? `${Math.min(...beds)} – ${Math.max(...beds)}` : '1';
    const bathroomsValue = baths.length > 0 ? `${Math.min(...baths)} – ${Math.max(...baths)}` : '1';
    const areaValue = areas.length > 0 ? `${Math.min(...areas).toLocaleString()} – ${Math.max(...areas).toLocaleString()} sqm` : 'N/A';

    const minPriceCents = units
        .map((u) => u.price)
        .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
        .reduce<number | null>((acc, p) => (acc === null ? p : Math.min(acc, p)), null);
    const startingPriceDisplay = bldg.starting_price
        ? (Number.isFinite(Number(bldg.starting_price)) ? formatCentsToCurrency(Number(bldg.starting_price)) : bldg.starting_price)
        : (minPriceCents != null ? formatCentsToCurrency(minPriceCents) : '—');

    return {
        totalUnits,
        availUnits,
        availPct,
        floorsValue,
        bedroomsValue,
        bathroomsValue,
        areaValue,
        startingPriceDisplay,
    };
}
