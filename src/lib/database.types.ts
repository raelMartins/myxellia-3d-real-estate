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

/** Section polygon for building plan: id, label, footprint in normalized 0-1 */
export interface SectionPlanSection {
    id: string
    label: string
    footprint: [number, number][]
}

/** Building section plan: base dimensions and sections (gold polygons) */
export interface SectionPlan {
    baseWidth: number
    baseDepth: number
    sections: SectionPlanSection[]
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
                    world_environment_id?: string | null
                    section_plan?: SectionPlan | null
                    ground_placement_pad?: Json | null
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
                    world_environment_id?: string | null
                    section_plan?: SectionPlan | null
                    ground_placement_pad?: Json | null
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
                    world_environment_id?: string | null
                    section_plan?: SectionPlan | null
                    ground_placement_pad?: Json | null
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
                    rotation: number | null
                    hotspots: InteriorHotspot[] | null
                    /** Present when column exists; true for units created from the building section plan apply flow. */
                    section_plan_sourced?: boolean
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
                    rotation?: number | null
                    section_plan_sourced?: boolean
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
                    rotation?: number | null
                    hotspots?: InteriorHotspot[] | null
                    section_plan_sourced?: boolean
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
            skybox_collections: {
                Row: {
                    id: string
                    created_at: string
                    label: string
                }
                Insert: {
                    id?: string
                    created_at?: string
                    label: string
                }
                Update: {
                    id?: string
                    created_at?: string
                    label?: string
                }
            }
            skybox_collection_slots: {
                Row: {
                    id: string
                    collection_id: string
                    label: string
                    file_url: string
                    sort_order: number
                }
                Insert: {
                    id?: string
                    collection_id: string
                    label: string
                    file_url: string
                    sort_order: number
                }
                Update: {
                    id?: string
                    collection_id?: string
                    label?: string
                    file_url?: string
                    sort_order?: number
                }
            }
            world_environments: {
                Row: {
                    id: string
                    created_at: string
                    label: string
                    ground_model_url: string
                    skybox_environment_id: string | null
                    skybox_collection_id: string | null
                    ground_placement_pad?: Json | null
                    active_surround_scatter_asset_id?: string | null
                    active_surround_catalog_asset_id?: string | null
                    surround_layout_mode?: string | null
                }
                Insert: {
                    id?: string
                    created_at?: string
                    label: string
                    ground_model_url: string
                    skybox_environment_id?: string | null
                    skybox_collection_id?: string | null
                    ground_placement_pad?: Json | null
                    active_surround_scatter_asset_id?: string | null
                    active_surround_catalog_asset_id?: string | null
                    surround_layout_mode?: string | null
                }
                Update: {
                    id?: string
                    created_at?: string
                    label?: string
                    ground_model_url?: string
                    skybox_environment_id?: string | null
                    skybox_collection_id?: string | null
                    ground_placement_pad?: Json | null
                    active_surround_scatter_asset_id?: string | null
                    active_surround_catalog_asset_id?: string | null
                    surround_layout_mode?: string | null
                }
            }
            surround_catalog_assets: {
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
            world_scatter_assets: {
                Row: {
                    id: string
                    created_at: string
                    world_environment_id: string
                    label: string
                    file_url: string
                    kind: string
                }
                Insert: {
                    id?: string
                    created_at?: string
                    world_environment_id: string
                    label: string
                    file_url: string
                    kind: string
                }
                Update: {
                    id?: string
                    created_at?: string
                    world_environment_id?: string
                    label?: string
                    file_url?: string
                    kind?: string
                }
            }
        }
    }
}

export type SurroundCatalogAssetRow =
    Database['public']['Tables']['surround_catalog_assets']['Row'];
export type UnitRow = Database['public']['Tables']['units']['Row'];
export type ReservationRow = Database['public']['Tables']['reservations']['Row'];
export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
