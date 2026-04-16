'use client';

import { useRef, useLayoutEffect, useCallback, useState, Suspense, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { Center, OrbitControls } from '@react-three/drei';
import { ModelLoader } from '@/engine/components/BuildingModel';
import type { SectionPlan } from '@/lib/database.types';
import { footprintWorldExtentsOnPlan } from '@/lib/sectionPlanUnits';
import type { ModelBoundsXZ } from '@/lib/sectionPlanUnits';
import { createFootprintPrismGeometry } from '@/lib/footprintPrismGeometry';

export type PlanViewBounds = { minX: number; maxX: number; minZ: number; maxZ: number };

export type StackPreview = { id: string; yStart: number | null; yEnd: number | null };

function tagBuildingMeshes(root: THREE.Object3D) {
    root.traverse((o) => {
        if (o instanceof THREE.Mesh) {
            o.userData.planBuilding = true;
        }
    });
}

function MeasureModel({
    modelUrl,
    modelExtension,
    onMeasured,
    onBuildingRoot,
}: {
    modelUrl: string;
    modelExtension?: string;
    onMeasured: (xz: PlanViewBounds, yMin: number, yMax: number) => void;
    onBuildingRoot: (root: THREE.Group | null) => void;
}) {
    const groupRef = useRef<THREE.Group>(null);

    useLayoutEffect(() => {
        const g = groupRef.current;
        if (!g) {
            onBuildingRoot(null);
            return;
        }
        const box = new THREE.Box3().setFromObject(g);
        const w = box.max.x - box.min.x;
        const d = box.max.z - box.min.z;
        if (w < 1e-6 || d < 1e-6) {
            onBuildingRoot(null);
            return;
        }
        tagBuildingMeshes(g);
        onBuildingRoot(g);
        onMeasured(
            { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z },
            box.min.y,
            box.max.y
        );
    }, [modelUrl, modelExtension, onMeasured, onBuildingRoot]);

    return (
        <group ref={groupRef}>
            <Center top>
                <ModelLoader url={modelUrl} extension={modelExtension} />
            </Center>
        </group>
    );
}

function ObliqueCameraRig({ xz, yMin, yMax }: { xz: PlanViewBounds; yMin: number; yMax: number }) {
    const { camera } = useThree();
    useLayoutEffect(() => {
        const cx = (xz.minX + xz.maxX) / 2;
        const cz = (xz.minZ + xz.maxZ) / 2;
        const wx = xz.maxX - xz.minX;
        const wz = xz.maxZ - xz.minZ;
        const wy = Math.max(0.5, yMax - yMin);
        const target = new THREE.Vector3(cx, (yMin + yMax) / 2, cz);
        const rad = Math.max(wx, wz, wy) * 1.35;
        const eye = target.clone().add(new THREE.Vector3(1, 0.5, 1).normalize().multiplyScalar(rad));
        camera.position.copy(eye);
        camera.lookAt(target);
        if ('updateProjectionMatrix' in camera) (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }, [camera, xz, yMin, yMax]);
    return null;
}

function FootprintOutline({
    footprint,
    modelBounds,
    y,
}: {
    footprint: [number, number][];
    modelBounds: ModelBoundsXZ;
    y: number;
}) {
    const lineObj = useMemo(() => {
        const pts: THREE.Vector3[] = footprint.map(([u, v]) => {
            const x = modelBounds.minX + u * (modelBounds.maxX - modelBounds.minX);
            const z = modelBounds.minZ + (1 - v) * (modelBounds.maxZ - modelBounds.minZ);
            return new THREE.Vector3(x, y, z);
        });
        if (pts.length >= 2) pts.push(pts[0].clone());
        const geom = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({ color: '#C6A664', transparent: true, opacity: 0.85 });
        return new THREE.Line(geom, mat);
    }, [footprint, modelBounds, y]);

    useLayoutEffect(() => {
        return () => {
            lineObj.geometry.dispose();
            (lineObj.material as THREE.Material).dispose();
        };
    }, [lineObj]);

    return <primitive object={lineObj} />;
}

function FootprintPrismMesh({
    footprintUv,
    width,
    height,
    depth,
    position,
    color,
    opacity,
    emissiveIntensity = 0.08,
}: {
    footprintUv: [number, number][];
    width: number;
    height: number;
    depth: number;
    position: [number, number, number];
    color: string;
    opacity: number;
    emissiveIntensity?: number;
}) {
    const geom = useMemo(
        () => createFootprintPrismGeometry(footprintUv, width, height, depth),
        [footprintUv, width, height, depth]
    );
    useLayoutEffect(() => {
        return () => {
            geom.dispose();
        };
    }, [geom]);

    return (
        <mesh position={position} geometry={geom}>
            <meshStandardMaterial
                color={color}
                transparent
                opacity={opacity}
                metalness={0.15}
                roughness={0.5}
                depthWrite={false}
                emissive={color}
                emissiveIntensity={emissiveIntensity}
            />
        </mesh>
    );
}

function StackPrisms({
    footprint,
    plan,
    modelBounds,
    stacks,
    activeStackId,
}: {
    footprint: [number, number][];
    plan: SectionPlan;
    modelBounds: ModelBoundsXZ;
    stacks: StackPreview[];
    activeStackId: string | null;
}) {
    const { centerX, centerZ, extentX, extentZ, footprintUv } = footprintWorldExtentsOnPlan(footprint, plan, modelBounds);
    return (
        <group>
            {stacks.map((s) => {
                if (s.yStart == null || s.yEnd == null) return null;
                const yLo = Math.min(s.yStart, s.yEnd);
                const yHi = Math.max(s.yStart, s.yEnd);
                const h = Math.max(0.05, yHi - yLo);
                const yc = (yLo + yHi) / 2;
                const selected = activeStackId === s.id;
                return (
                    <FootprintPrismMesh
                        key={s.id}
                        footprintUv={footprintUv}
                        width={extentX}
                        height={h}
                        depth={extentZ}
                        position={[centerX, yc, centerZ]}
                        color={selected ? '#F5F7FA' : '#C6A664'}
                        opacity={selected ? 0.42 : 0.2}
                        emissiveIntensity={selected ? 0.2 : 0.06}
                    />
                );
            })}
        </group>
    );
}

function SectionVolumeShell({
    footprint,
    plan,
    modelBounds,
    modelYMin,
    modelYMax,
}: {
    footprint: [number, number][];
    plan: SectionPlan;
    modelBounds: ModelBoundsXZ;
    modelYMin: number;
    modelYMax: number;
}) {
    const { centerX, centerZ, extentX, extentZ, footprintUv } = footprintWorldExtentsOnPlan(footprint, plan, modelBounds);
    const h = Math.max(0.1, modelYMax - modelYMin);
    const yc = (modelYMin + modelYMax) / 2;
    return (
        <FootprintPrismMesh
            footprintUv={footprintUv}
            width={extentX}
            height={h}
            depth={extentZ}
            position={[centerX, yc, centerZ]}
            color="#C6A664"
            opacity={0.06}
            emissiveIntensity={0.04}
        />
    );
}

function BuildingYPickHandler({
    enabled,
    buildingRoot,
    onY,
}: {
    enabled: boolean;
    buildingRoot: THREE.Object3D | null;
    onY?: (y: number) => void;
}) {
    const { camera, gl } = useThree();
    const raycaster = useRef(new THREE.Raycaster());
    const pointer = useRef(new THREE.Vector2());

    useEffect(() => {
        if (!enabled || !buildingRoot || !onY) return;
        const el = gl.domElement;
        const onDown = (e: PointerEvent) => {
            const r = el.getBoundingClientRect();
            pointer.current.x = ((e.clientX - r.left) / r.width) * 2 - 1;
            pointer.current.y = -((e.clientY - r.top) / r.height) * 2 + 1;
            raycaster.current.setFromCamera(pointer.current, camera);
            const hits = raycaster.current.intersectObjects(buildingRoot.children, true).filter((h) => {
                const o = h.object;
                return o instanceof THREE.Mesh && o.userData.planBuilding === true;
            });
            const y = hits[0]?.point?.y;
            if (y !== undefined && Number.isFinite(y)) onY(y);
        };
        el.addEventListener('pointerdown', onDown, true);
        return () => el.removeEventListener('pointerdown', onDown, true);
    }, [enabled, buildingRoot, camera, gl, onY]);

    return null;
}

function ObliqueScene({
    modelUrl,
    modelExtension,
    plan,
    sectionFootprint,
    stacks,
    activeStackId,
    pickEnabled,
    onPickWorldY,
}: {
    modelUrl: string;
    modelExtension?: string;
    plan: SectionPlan;
    sectionFootprint: [number, number][];
    stacks: StackPreview[];
    activeStackId: string | null;
    pickEnabled: boolean;
    onPickWorldY?: (y: number) => void;
}) {
    const [xz, setXz] = useState<PlanViewBounds | null>(null);
    const [yMin, setYMin] = useState(0);
    const [yMax, setYMax] = useState(1);
    const [buildingRoot, setBuildingRoot] = useState<THREE.Group | null>(null);

    const onMeasured = useCallback((b: PlanViewBounds, ymin: number, ymax: number) => {
        setXz(b);
        setYMin(ymin);
        setYMax(ymax);
    }, []);

    const mb: ModelBoundsXZ | null = xz ? { minX: xz.minX, maxX: xz.maxX, minZ: xz.minZ, maxZ: xz.maxZ } : null;

    return (
        <>
            <color attach="background" args={['#0A0A0B']} />
            <ambientLight intensity={0.55} />
            <directionalLight position={[8, 14, 6]} intensity={0.9} castShadow />
            <Suspense fallback={null}>
                <MeasureModel
                    modelUrl={modelUrl}
                    modelExtension={modelExtension}
                    onMeasured={onMeasured}
                    onBuildingRoot={setBuildingRoot}
                />
            </Suspense>
            {xz && mb && (
                <>
                    <ObliqueCameraRig xz={xz} yMin={yMin} yMax={yMax} />
                    <SectionVolumeShell
                        footprint={sectionFootprint}
                        plan={plan}
                        modelBounds={mb}
                        modelYMin={yMin}
                        modelYMax={yMax}
                    />
                    <FootprintOutline footprint={sectionFootprint} modelBounds={mb} y={yMin + 0.02} />
                    <StackPrisms
                        footprint={sectionFootprint}
                        plan={plan}
                        modelBounds={mb}
                        stacks={stacks}
                        activeStackId={activeStackId}
                    />
                </>
            )}
            <BuildingYPickHandler enabled={pickEnabled} buildingRoot={buildingRoot} onY={onPickWorldY} />
            <OrbitControls makeDefault enableDamping dampingFactor={0.06} minDistance={2} maxDistance={120} enabled={!pickEnabled} />
        </>
    );
}

export default function SectionObliqueCanvas({
    modelUrl,
    modelExtension,
    plan,
    sectionFootprint,
    stacks,
    activeStackId,
    pickEnabled = false,
    onPickWorldY,
    height = 360,
}: {
    modelUrl: string;
    modelExtension?: string;
    plan: SectionPlan;
    sectionFootprint: [number, number][];
    stacks: StackPreview[];
    activeStackId: string | null;
    pickEnabled?: boolean;
    onPickWorldY?: (y: number) => void;
    height?: number;
}) {
    return (
        <div className="rounded-xl border border-white/10 overflow-hidden bg-[#0A0A0B]" style={{ height, minHeight: height }}>
            <Canvas
                style={{ display: 'block', width: '100%', height: '100%' }}
                gl={{ antialias: true, alpha: false }}
                dpr={[1, 1.5]}
                camera={{ fov: 38, near: 0.05, far: 500, position: [10, 8, 10] }}
            >
                <ObliqueScene
                    modelUrl={modelUrl}
                    modelExtension={modelExtension}
                    plan={plan}
                    sectionFootprint={sectionFootprint}
                    stacks={stacks}
                    activeStackId={activeStackId}
                    pickEnabled={pickEnabled}
                    onPickWorldY={onPickWorldY}
                />
            </Canvas>
        </div>
    );
}
