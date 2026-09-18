import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * The hero's 3D centerpiece: a faceted glass "core" (the private credential)
 * orbited by three luminous nodes (nullifiers/votes) tracing independent
 * rings — a literal render of the same private-core / public-orbit story
 * the page tells in text. Deliberately plain `three`, not react-three-fiber
 * + drei: one static scene with no scene graph reactivity needed, so the
 * extra abstraction would only add bundle weight without buying anything.
 *
 * Lifecycle discipline matters here more than usual: this mounts on the
 * very first paint of a real, funded dApp, so a leaked renderer/animation
 * loop from a fast connect→disconnect→reconnect cycle would compound. Every
 * GPU resource created below is disposed on unmount, the render loop pauses
 * via IntersectionObserver when scrolled out of view and via
 * document.hidden when the tab is backgrounded, and the loop is a plain
 * cancelable rAF chain, not setInterval.
 */
export function PrivacyCore() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const styles = getComputedStyle(document.documentElement);
    const accent = new THREE.Color(styles.getPropertyValue('--lime-deep').trim() || '#4fd6b5');
    const accentDim = new THREE.Color(styles.getPropertyValue('--lime').trim() || '#1a9c80');

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0.3, 10.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);

    // ----- Core: a faceted, semi-transparent crystal ------------------
    const core = new THREE.Group();
    const coreGeometry = new THREE.IcosahedronGeometry(1.3, 1);
    const coreMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x0d1f1a,
      roughness: 0.15,
      metalness: 0.1,
      transmission: 0.85,
      thickness: 1.4,
      ior: 1.4,
      transparent: true,
      opacity: 0.75,
      clearcoat: 1,
      clearcoatRoughness: 0.2,
      emissive: accentDim,
      emissiveIntensity: 0.1,
    });
    core.add(new THREE.Mesh(coreGeometry, coreMaterial));

    const wireframe = new THREE.LineSegments(
      new THREE.EdgesGeometry(coreGeometry),
      new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.35 }),
    );
    core.add(wireframe);

    const rig = new THREE.Group();
    rig.position.y = -0.85;
    rig.add(core);
    scene.add(rig);

    // ----- Orbit rings + nodes: public nullifiers circling the private core
    const orbitGroup = new THREE.Group();
    const nodeGlowTexture = createGlowTexture();
    type Orbit = { pivot: THREE.Group; speed: number };
    const orbits: Orbit[] = [];

    [
      { radius: 2.05, tilt: 0.15, speed: 0.22 },
      { radius: 2.5, tilt: -0.55, speed: -0.15 },
      { radius: 2.25, tilt: 1.05, speed: 0.18 },
    ].forEach(({ radius, tilt, speed }) => {
      const ringGeometry = new THREE.TorusGeometry(radius, 0.004, 8, 128);
      const ringMaterial = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.18 });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = Math.PI / 2 + tilt;
      orbitGroup.add(ring);

      const pivot = new THREE.Group();
      pivot.rotation.x = Math.PI / 2 + tilt;
      const node = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 24, 24),
        new THREE.MeshBasicMaterial({ color: accent }),
      );
      node.position.set(radius, 0, 0);
      pivot.add(node);

      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: nodeGlowTexture, color: accent, transparent: true, opacity: 0.9, depthWrite: false }),
      );
      glow.scale.set(0.9, 0.9, 1);
      glow.position.copy(node.position);
      pivot.add(glow);

      orbitGroup.add(pivot);
      orbits.push({ pivot, speed });
    });
    rig.add(orbitGroup);

    // ----- Lighting: soft key + emerald rim, per the skill's cinematic-not-gamey brief
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(3, 4, 5);
    scene.add(key);
    const rim = new THREE.PointLight(accent, 6, 12);
    rim.position.set(-3, -1.5, -2);
    scene.add(rim);

    // ----- Pointer parallax (subtle, lerped — never a snap) ------------
    const pointer = { x: 0, y: 0 };
    const targetRotation = { x: 0, y: 0 };
    const onPointerMove = (event: PointerEvent) => {
      const bounds = host.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = ((event.clientY - bounds.top) / bounds.height) * 2 - 1;
    };
    window.addEventListener('pointermove', onPointerMove);

    const resize = () => {
      const bounds = host.getBoundingClientRect();
      if (bounds.width === 0 || bounds.height === 0) return;
      camera.aspect = bounds.width / bounds.height;
      camera.updateProjectionMatrix();
      renderer.setSize(bounds.width, bounds.height);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    let frame = 0;
    let visible = true;
    const clock = new THREE.Clock();

    const tick = () => {
      const elapsed = clock.getElapsedTime();

      core.rotation.y = elapsed * 0.18;
      core.rotation.x = Math.sin(elapsed * 0.3) * 0.12;

      orbits.forEach(({ pivot, speed }) => {
        pivot.rotation.z = elapsed * speed;
      });

      targetRotation.x += (pointer.y * 0.18 - targetRotation.x) * 0.04;
      targetRotation.y += (pointer.x * 0.22 - targetRotation.y) * 0.04;
      rig.rotation.x = targetRotation.x;
      rig.rotation.y = targetRotation.y;

      renderer.render(scene, camera);
      frame = visible && !document.hidden ? requestAnimationFrame(tick) : 0;
    };

    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      if (visible && !frame) frame = requestAnimationFrame(tick);
      if (!visible && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    });
    intersection.observe(host);

    frame = requestAnimationFrame(tick);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersection.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      host.removeChild(renderer.domElement);
      coreGeometry.dispose();
      coreMaterial.dispose();
      wireframe.geometry.dispose();
      (wireframe.material as THREE.Material).dispose();
      nodeGlowTexture.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
          object.geometry?.dispose?.();
          const material = object.material as THREE.Material | THREE.Material[];
          (Array.isArray(material) ? material : [material]).forEach((m) => m?.dispose());
        }
      });
      renderer.dispose();
    };
  }, []);

  return <div ref={hostRef} className="privacy-core-canvas" aria-hidden="true" />;
}

/** A soft radial-gradient sprite texture used as a cheap glow behind each orbit node — avoids pulling in a full postprocessing/bloom pipeline for one small effect. */
function createGlowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
