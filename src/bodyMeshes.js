import * as THREE from 'three';
import { PLANETS } from './planets.js';
import { MOONS } from './moons.js';
import { ASTEROIDS } from './asteroids.js';
import { buildBodyMesh, buildFallbackMesh, applyShape } from './bodyMesh.js';
import { buildSaturnRing } from './saturnRing.js';
import { MOON_OWNER_BASE } from './phase.js';

const SATURN_IDX = PLANETS.findIndex((p) => p.id === 'saturn');

/**
 * Flat-triangle icosphere mesh per tělo (V3 stylu — žádný shader,
 * MeshBasicMaterial s vertexColors). Saturnův prsten = real RingGeometry
 * mesh. Mesh-y jsou skryté (visible=false) dokud nedoletí dost teček —
 * formation gating řeší tick() v main.js.
 *
 * Naplní předaný `bodyMeshes` objekt a `gatedMeshes` pole (main.js je dál
 * vlastní beze změny) a vrátí pole asteroidních meshů — ty main.js sám
 * pushne do `_revealAfterFormation` (objeví se až po formaci).
 *
 * @returns {THREE.Mesh[]} asteroidMeshes
 */
export function buildBodyMeshes({
  spins, moonAnchors, asteroidAnchors, imageData, moonImageData, asteroidImageData, bodyMeshes, gatedMeshes,
}) {
  for (let i = 0; i < PLANETS.length; i++) {
    const p = PLANETS[i];
    const tex = imageData[p.id];
    if (!tex) continue;
    // Sun je 50× větší než největší planeta → potřebuje hustší icosphere
    // jinak vidíš low-poly facety. L6 (40962 verts = 81920 trianglů).
    const subdiv = p.id === 'sun' ? 40962 : 10242;
    const mesh = buildBodyMesh(tex, p.radiusPx, subdiv);
    // Sun je zdroj světla (ne příjemce) — flat MeshBasicMaterial vždy plné jasné.
    if (p.id === 'sun') {
      mesh.material = new THREE.MeshBasicMaterial({
        vertexColors: true, transparent: true, opacity: 1.0,
      });
    }
    mesh.visible = false;
    spins[p.id].add(mesh);
    bodyMeshes[p.id] = mesh;
    // Sun vyňat z gatedMeshes — jeho reveal řídí explicitní t>=6.0 gate v
    // tick() (countSettled gating pro Slunce nefunguje, viz komentář tamtéž).
    if (p.id !== 'sun') gatedMeshes.push({ key: p.id, ownerIdx: i, isPlanet: true, isMoon: false });

    if (p.id === 'saturn' && imageData.saturn_ring) {
      const ring = buildSaturnRing(imageData.saturn_ring, p.ringInnerRadius, p.ringOuterRadius);
      ring.visible = false;
      spins.saturn.add(ring);
      bodyMeshes['saturn_ring'] = ring;
      gatedMeshes.push({ key: 'saturn_ring', ownerIdx: SATURN_IDX, isPlanet: false, isMoon: false, parentId: 'saturn' });
    }
  }
  for (let i = 0; i < MOONS.length; i++) {
    const m = MOONS[i];
    const tex = moonImageData[m.id];
    let mesh;
    let isFallback = false;
    if (tex) {
      // L5 (10242 verts) — L4 dělalo facety viditelné v detail view (Titan, Luna).
      mesh = buildBodyMesh(tex, m.radiusPx, 10242);
    } else if (m.texture !== null) {
      // texture má cestu ale se nestáhla — přeskoč (loader selhal)
      continue;
    } else {
      // texture: null záměrně — fallback barevná sféra
      mesh = buildFallbackMesh(m.radiusPx, m.color || '#808080', 10242, m.id);
      isFallback = true;
    }
    applyShape(mesh, m);
    moonAnchors[m.id].add(mesh);
    bodyMeshes[m.id] = mesh;
    if (isFallback) {
      // Fallback mesh nemá particle formation → visible ihned, bez gating.
      mesh.visible = true;
      mesh.userData.settled = true;
    } else {
      mesh.visible = false;
      gatedMeshes.push({ key: m.id, ownerIdx: MOON_OWNER_BASE + i, isPlanet: false, isMoon: true, parentId: m.parent });
    }
  }
  // Asteroid meshes (Ceres / Vesta / Pallas) — nejsou gated (žádný particle
  // owner); objeví se až po formaci (main.js pushne do _revealAfterFormation).
  const asteroidMeshes = [];
  for (const a of ASTEROIDS) {
    const tex = asteroidImageData[a.id] ?? null;
    let mesh;
    if (tex) {
      mesh = buildBodyMesh(tex, a.radiusPx, 2562);
    } else if (a.texture !== null) {
      // texture má cestu ale se nestáhla — přeskoč
      continue;
    } else {
      // texture: null záměrně — fallback barevná sféra
      mesh = buildFallbackMesh(a.radiusPx, a.color || '#808080', 2562, a.id);
    }
    applyShape(mesh, a);
    mesh.visible = false;
    asteroidMeshes.push(mesh);
    asteroidAnchors[a.id].add(mesh);
    bodyMeshes[a.id] = mesh;
  }
  return asteroidMeshes;
}
