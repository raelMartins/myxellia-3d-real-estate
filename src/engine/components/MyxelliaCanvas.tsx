"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { PresetsType } from "@react-three/drei/helpers/environment-assets";
import AssetLoader from "./AssetLoader";
import BuildingModel from "./BuildingModel";
import WorldEnvironmentMesh from "./WorldEnvironmentMesh";
import PlacementPadGizmo from "./PlacementPadGizmo";
import WorldGroundOrbitLimits from "./WorldGroundOrbitLimits";
import PlacementPadEditCameraBridge from "./PlacementPadEditCameraBridge";
import GroundedSkyboxEnv from "./GroundedSkyboxEnv";
import InteriorModel from "./InteriorModel";
import PrismKeyboardEdit from "./PrismKeyboardEdit";
import { useEngineStore } from "@/engine/store/engine.store";
import { resolveExteriorHdriUrl } from "@/lib/skyboxEnvResolve";
import { pickEffectiveWorldEnvironment } from "@/lib/pickEffectiveWorldEnvironment";
import {
  fetchWorldEnvironmentById,
  isSurroundLayoutMode,
  type SurroundLayoutMode,
  type WorldEnvironmentWithSky,
} from "@/lib/worldEnvironments";
import { useAuthStore } from "@/store/auth.store";

type LightingKey = "morning" | "golden" | "night";

function ScreenshotCapture() {
  const { gl } = useThree();
  const setScreenshotHandler = useEngineStore((s) => s.setScreenshotHandler);
  useEffect(() => {
    const handler = () =>
      new Promise<string>((resolve) => {
        requestAnimationFrame(() => {
          try {
            const data = gl.domElement.toDataURL("image/jpeg", 0.85);
            resolve(data);
          } catch {
            resolve("");
          }
        });
      });
    setScreenshotHandler(() => handler());
    return () => setScreenshotHandler(null);
  }, [gl, setScreenshotHandler]);
  return null;
}

function InteriorCameraReset() {
  const { camera } = useThree();
  const viewMode = useEngineStore((s) => s.viewMode);
  useEffect(() => {
    if (viewMode !== "interior") return;
    camera.position.set(28, 22, 28);
    camera.updateProjectionMatrix();
  }, [viewMode, camera]);
  return null;
}

function HotspotPlacementCapture() {
  const { gl, camera, scene } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());
  const hotspotPlacementMode = useEngineStore((s) => s.hotspotPlacementMode);
  const setHotspotPlacementMode = useEngineStore(
    (s) => s.setHotspotPlacementMode,
  );
  const setCapturedHotspotPosition = useEngineStore(
    (s) => s.setCapturedHotspotPosition,
  );

  useEffect(() => {
    if (!hotspotPlacementMode) return;
    const el = gl.domElement;
    const onPointerDown = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.current.setFromCamera(mouse.current, camera);
      const hits = raycaster.current.intersectObjects(scene.children, true);
      const hit = hits.find((i) => i.object instanceof THREE.Mesh);
      if (hit?.point) {
        const p = hit.point;
        setCapturedHotspotPosition([p.x, p.y, p.z]);
        setHotspotPlacementMode(false);
      }
    };
    el.addEventListener("pointerdown", onPointerDown);
    return () => el.removeEventListener("pointerdown", onPointerDown);
  }, [
    hotspotPlacementMode,
    gl,
    camera,
    scene,
    setHotspotPlacementMode,
    setCapturedHotspotPosition,
  ]);
  return null;
}

const LIGHTING = {
  morning: {
    preset: "dawn" as const,
    ambient: 0.6,
    dirColor: "#FFD9A0",
    dirIntensity: 1.2,
    dirPos: [8, 20, 8] as [number, number, number],
  },
  golden: {
    preset: "sunset" as const,
    ambient: 0.4,
    dirColor: "#FFC060",
    dirIntensity: 1.8,
    dirPos: [-15, 12, 10] as [number, number, number],
  },
  night: {
    preset: "night" as const,
    ambient: 0.15,
    dirColor: "#8EB4FF",
    dirIntensity: 0.6,
    dirPos: [0, 30, 0] as [number, number, number],
  },
};

function useEffectiveWorldEnvironment() {
  const buildingWorldEnvironment = useEngineStore(
    (s) => s.buildingWorldEnvironment,
  );
  const selectedWorldEnvironmentId = useEngineStore(
    (s) => s.selectedWorldEnvironmentId,
  );
  const worldEnvironments = useEngineStore((s) => s.worldEnvironments);
  return useMemo(
    () =>
      pickEffectiveWorldEnvironment(
        selectedWorldEnvironmentId,
        buildingWorldEnvironment,
        worldEnvironments,
      ),
    [buildingWorldEnvironment, selectedWorldEnvironmentId, worldEnvironments],
  );
}

/**
 * Building embed / list rows can omit or stale `world_scatter_assets`; refetch world by id for scatter fields.
 */
function useScatterWorldRow(
  effectiveWorld: WorldEnvironmentWithSky | null,
  viewMode: string,
) {
  const [row, setRow] = useState<WorldEnvironmentWithSky | null>(null);
  useEffect(() => {
    const wid = effectiveWorld?.id;
    if (!wid || viewMode !== "exterior") {
      setRow(null);
      return;
    }
    let cancelled = false;
    const run = async () => {
      const token = useAuthStore.getState().session?.access_token;
      const fresh = await fetchWorldEnvironmentById(wid, () => token);
      if (cancelled || !fresh || fresh.id !== wid) return;
      setRow(fresh);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [
    effectiveWorld?.id,
    effectiveWorld?.active_surround_scatter_asset_id,
    effectiveWorld?.active_surround_catalog_asset_id,
    effectiveWorld?.surround_layout_mode,
    viewMode,
    (effectiveWorld?.world_scatter_assets ?? []).length,
  ]);
  return row;
}

function EngineOrbitControlsBridge() {
  const padDragging = useEngineStore((s) => s.padHandleDragging);
  const controls = useThree((state) => state.controls) as {
    enabled?: boolean;
  } | null;
  useEffect(() => {
    if (controls && typeof controls.enabled === "boolean") {
      controls.enabled = !padDragging;
    }
  }, [controls, padDragging]);
  return null;
}

export default function MyxelliaCanvas() {
  const {
    viewMode,
    lightingMode,
    building,
    selectedSkyboxUrl,
    selectedCatalogCollectionId,
    selectedSkyboxSlotId,
    skyboxCollections,
    placementPadEditActive,
  } = useEngineStore();
  const effectiveWorld = useEffectiveWorldEnvironment();
  const scatterWorldFresh = useScatterWorldRow(effectiveWorld, viewMode);
  const scatterForWorld = useMemo(() => {
    const ew =
      scatterWorldFresh?.id === effectiveWorld?.id
        ? scatterWorldFresh
        : effectiveWorld;
    if (!ew?.id) return null;
    const catId = ew.active_surround_catalog_asset_id;
    const layoutRaw = ew.surround_layout_mode;
    const layout = isSurroundLayoutMode(layoutRaw) ? layoutRaw : null;
    const cat = ew.surround_catalog;
    if (catId && layout && cat?.file_url && cat.id === catId) {
      return { url: cat.file_url, layoutMode: layout, worldId: ew.id };
    }
    const aid = ew.active_surround_scatter_asset_id;
    if (!aid) return null;
    const row = (ew.world_scatter_assets ?? []).find((a) => a.id === aid);
    if (!row?.file_url) return null;
    const layoutMode: SurroundLayoutMode =
      row.kind === "tree" ? "spread" : "packed";
    return { url: row.file_url, layoutMode, worldId: ew.id };
  }, [effectiveWorld, scatterWorldFresh]);
  const worldOrbitRootRef = useRef<THREE.Group | null>(null);
  const L = LIGHTING[lightingMode as LightingKey];

  const [tabVisible, setTabVisible] = useState(true);
  useEffect(() => {
    const onVis = () => setTabVisible(!document.hidden);
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const { url: envUrl } = useMemo(
    () =>
      resolveExteriorHdriUrl({
        skyNone: selectedSkyboxUrl === "__none__",
        effectiveWorld,
        selectedSkyboxSlotId,
        catalogCollectionId: selectedCatalogCollectionId,
        skyboxCollections,
        buildingGeneratedEnvUrl: building?.generated_env_url,
      }),
    [
      selectedSkyboxUrl,
      effectiveWorld,
      selectedSkyboxSlotId,
      selectedCatalogCollectionId,
      skyboxCollections,
      building?.generated_env_url,
    ],
  );
  const hasCustomEnv = !!envUrl;

  const envCtx = (building?.env_context || "").toLowerCase();
  const useCloudFog =
    envCtx.includes("hillside") ||
    envCtx.includes("mountain") ||
    envCtx.includes("misty") ||
    envCtx.includes("cloud");
  const useForest =
    envCtx.includes("forest") ||
    envCtx.includes("lush") ||
    envCtx.includes("jungle") ||
    envCtx.includes("garden");
  const useBeach =
    envCtx.includes("beach") ||
    envCtx.includes("ocean") ||
    envCtx.includes("tropical") ||
    envCtx.includes("coast");

  let finalPreset: PresetsType = L.preset;
  if (useForest && lightingMode !== "night") finalPreset = "park";
  if (useBeach && lightingMode !== "night") finalPreset = "apartment";

  return (
    <Canvas
      camera={{ position: [3.4, 2.75, 3.4], fov: 32 }}
      dpr={[1, 2]}
      frameloop={tabVisible ? "always" : "never"}
      gl={{
        preserveDrawingBuffer: true,
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      }}
      shadows
    >
      {viewMode === "exterior" && !hasCustomEnv && (
        <color attach="background" args={["#0A0A0B"]} />
      )}

      {viewMode === "exterior" && useCloudFog && !hasCustomEnv && (
        <fog attach="fog" args={["#141416", 10, 80]} />
      )}

      <ambientLight intensity={L.ambient} />
      <directionalLight
        position={L.dirPos}
        intensity={L.dirIntensity}
        color={L.dirColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />

      <Suspense fallback={<AssetLoader />}>
        {viewMode === "exterior" && (
          <ErrorBoundary fallback={null}>
            {hasCustomEnv && envUrl ? (
              envUrl.toLowerCase().match(/\.(hdr|hdri)(\?|$)/) ? (
                <GroundedSkyboxEnv envUrl={envUrl} />
              ) : (
                <Environment files={envUrl} background />
              )
            ) : (
              <Environment preset={finalPreset} background={true} />
            )}
          </ErrorBoundary>
        )}

        {viewMode === "exterior" && effectiveWorld?.ground_model_url ? (
          <group ref={worldOrbitRootRef}>
            <WorldEnvironmentMesh
              url={effectiveWorld.ground_model_url}
              envContext={building?.env_context}
              scatter={scatterForWorld}
            />
          </group>
        ) : null}
        {viewMode === "exterior" ? <PlacementPadGizmo /> : null}
        {viewMode === "exterior" ? <BuildingModel /> : <InteriorModel />}
        {viewMode === "exterior" && <PrismKeyboardEdit />}
        {viewMode === "exterior" && <ScreenshotCapture />}
        {viewMode === "interior" && <InteriorCameraReset />}
        {viewMode === "interior" && <HotspotPlacementCapture />}
      </Suspense>

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.06}
        enableRotate={viewMode === "interior" ? true : !placementPadEditActive}
        target={viewMode === "interior" ? [0, -1, 0] : undefined}
        minPolarAngle={0.1}
        maxPolarAngle={Math.PI / 2}
        minDistance={viewMode === "interior" ? 1.5 : 4}
        maxDistance={viewMode === "interior" ? 180 : 144}
        enablePan={false}
      />
      <EngineOrbitControlsBridge />
      <WorldGroundOrbitLimits
        worldRootRef={worldOrbitRootRef}
        groundUrl={
          viewMode === "exterior" ? effectiveWorld?.ground_model_url : null
        }
      />
      <PlacementPadEditCameraBridge />
    </Canvas>
  );
}
