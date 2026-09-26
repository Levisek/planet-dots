import * as THREE from 'three';

/**
 * Lighting toggle button — přepíná material na všech body mesh-ích:
 * VYP → MeshBasicMaterial (flat, plné barvy, ignoruje světla).
 * ZAP → MeshLambertMaterial (Lambertian, den/noc strana podle PointLight z origin).
 * Sun zůstává vždy MeshBasicMaterial (self-emissive zdroj světla).
 *
 * @param {{ bodyMeshes: object, setLightingMode: (on: boolean) => void, onLightingModeChange: (cb: (real: boolean) => void) => void }} opts
 */
export function initLightingToggle({ bodyMeshes, setLightingMode, onLightingModeChange }) {
  onLightingModeChange((real) => {
    for (const id in bodyMeshes) {
      if (id === 'sun' || id === 'saturn_ring') continue;
      const mesh = bodyMeshes[id];
      if (!mesh) continue;
      if (real) {
        if (!mesh.userData._lambertMaterial) {
          mesh.userData._lambertMaterial = new THREE.MeshLambertMaterial({
            vertexColors: true,
            transparent: false,
            opacity: 1,
          });
        }
        mesh.material = mesh.userData._lambertMaterial;
      } else {
        mesh.material = mesh.userData._flatMaterial;
      }
    }
  });
  const lightingBtn = document.getElementById('toggleLighting');
  let _lightingOn = false;
  lightingBtn?.addEventListener('click', () => {
    _lightingOn = !_lightingOn;
    setLightingMode(_lightingOn);
    lightingBtn.textContent = _lightingOn ? 'STÍNY: ZAP' : 'STÍNY: VYP';
    lightingBtn.classList.toggle('active', _lightingOn);
  });
}
