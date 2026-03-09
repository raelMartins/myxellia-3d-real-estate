export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

/** Interior view hotspot: 3D position + content for the info card */
export interface InteriorHotspot {
    id: string
    position: [number, number, number]
    title: string
    material?: string
    description?: string
}

export interface Database {
    public: {
        Tables: {
            buildings: {
                Row: {
                    id: string
                    created_at: string
                    name: string
                    description: string | null
                    model_url: string | null
                    thumbnail_url: string | null
                    location: string | null
                    total_units: number
                    tagline?: string | null
                    starting_price?: string | null
                    hero_url?: string | null
                    env_context?: string | null
                    store_url?: string | null
                    generated_env_url?: string | null
                }
                Insert: {
                    id?: string
                    created_at?: string
                    name: string
                    description?: string | null
                    model_url?: string | null
                    thumbnail_url?: string | null
                    location?: string | null
                    total_units?: number
                    tagline?: string | null
                    starting_price?: string | null
                    hero_url?: string | null
                    env_context?: string | null
                    store_url?: string | null
                    generated_env_url?: string | null
                }
                Update: {
                    id?: string
                    created_at?: string
                    name?: string
                    description?: string | null
                    model_url?: string | null
                    thumbnail_url?: string | null
                    location?: string | null
                    total_units?: number
                    tagline?: string | null
                    starting_price?: string | null
                    hero_url?: string | null
                    env_context?: string | null
                    store_url?: string | null
                    generated_env_url?: string | null
                }
            }
            units: {
                Row: {
                    id: string
                    created_at: string
                    building_id: string
                    unit_number: string
                    floor: number
                    price: number | null
                    area_sqm: number | null
                    bedrooms: number | null
                    bathrooms: number | null
                    status: 'available' | 'pending' | 'sold'
                    locked_at: string | null
                    locked_by: string | null
                    mesh_id: string | null
                    display_name: string | null
                    view_type: string | null
                    amenities: string | null
                    perks: string | null
                    internal_model_url: string | null
                    deleted_at: string | null
                    position: [number, number, number] | null
                    size: [number, number, number] | null
                    footprint: [number, number][] | null
                    hotspots: InteriorHotspot[] | null
                }
                Insert: {
                    id?: string
                    created_at?: string
                    building_id: string
                    unit_number: string
                    floor?: number
                    price?: number | string | null
                    area_sqm?: number | null
                    bedrooms?: number | null
                    bathrooms?: number | null
                    status?: 'available' | 'pending' | 'sold'
                    locked_at?: string | null
                    locked_by?: string | null
                    mesh_id?: string | null
                    display_name?: string | null
                    view_type?: string | null
                    amenities?: string | null
                    perks?: string | null
                    internal_model_url?: string | null
                    deleted_at?: string | null
                    position?: [number, number, number] | null
                    size?: [number, number, number] | null
                    footprint?: [number, number][] | null
                }
                Update: {
                    id?: string
                    created_at?: string
                    building_id?: string
                    unit_number?: string
                    floor?: number
                    price?: number | null
                    area_sqm?: number | null
                    bedrooms?: number | null
                    bathrooms?: number | null
                    status?: 'available' | 'pending' | 'sold'
                    locked_at?: string | null
                    locked_by?: string | null
                    mesh_id?: string | null
                    display_name?: string | null
                    view_type?: string | null
                    amenities?: string | null
                    perks?: string | null
                    internal_model_url?: string | null
                    deleted_at?: string | null
                    position?: [number, number, number] | null
                    size?: [number, number, number] | null
                    footprint?: [number, number][] | null
                    hotspots?: InteriorHotspot[] | null
                }
            }
            reservations: {
                Row: {
                    id: string
                    created_at: string
                    unit_id: string
                    user_id: string
                    status: 'soft_lock' | 'approved' | 'rejected' | 'expired'
                    expires_at: string | null
                }
                Insert: {
                    id?: string
                    created_at?: string
                    unit_id: string
                    user_id: string
                    status?: 'soft_lock' | 'approved' | 'rejected' | 'expired'
                    expires_at?: string | null
                }
                Update: {
                    id?: string
                    created_at?: string
                    unit_id?: string
                    user_id?: string
                    status?: 'soft_lock' | 'approved' | 'rejected' | 'expired'
                    expires_at?: string | null
                }
            }
            profiles: {
                Row: {
                    id: string
                    created_at: string
                    role: 'admin' | 'client'
                    full_name: string | null
                    company: string | null
                }
                Insert: {
                    id: string
                    created_at?: string
                    role?: 'admin' | 'client'
                    full_name?: string | null
                    company?: string | null
                }
                Update: {
                    id?: string
                    created_at?: string
                    role?: 'admin' | 'client'
                    full_name?: string | null
                    company?: string | null
                }
            }
            skybox_environments: {
                Row: {
                    id: string
                    created_at: string
                    label: string
                    file_url: string
                }
                Insert: {
                    id?: string
                    created_at?: string
                    label: string
                    file_url: string
                }
                Update: {
                    id?: string
                    created_at?: string
                    label?: string
                    file_url?: string
                }
            }
        }
    }
}
