import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * The hero's 3D centerpiece: a faceted glass "core" (the private credential)
 * orbited by luminous nodes (nullifiers/votes) tracing independent rings and
 * tethered to the core by thin proof-lines, suspended in a drifting particle
 * field — a literal render of the same private-core / public-orbit story the
 * page tells in text. Deliberately plain `three`, not react-three-fiber +
 * drei: one static scene with no scene graph reactivity needed, so the extra
 * abstraction would only add bundle weight without buying anything.
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
    const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 100);
    camera.position.set(0, 0.4, 9.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);

    const rig = new THREE.Group();
    rig.position.y = -0.7;
    scene.add(rig);

    // ----- Ambient particle field: a slowly drifting cloud filling the whole
    // canvas, so the scene reads as an environment, not one small icon.
    const particleCount = 420;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i += 1) {
      const radius = 4.5 + Math.random() * 7;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      particlePositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      particlePositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.6;
      particlePositions[i * 3 + 2] = radius * Math.cos(phi);
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleTexture = createGlowTexture();
    const particleMaterial = new THREE.PointsMaterial({
      size: 0.05,
      map: particleTexture,
      transparent: true,
      opacity: 0.55,
      color: accentDim,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // ----- Core: a faceted, semi-transparent crystal ------------------
    const core = new THREE.Group();
    const coreGeometry = new THREE.IcosahedronGeometry(1.55, 1);
    const coreMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x0d1f1a,
      roughness: 0.12,
      metalness: 0.15,
      transmission: 0.82,
      thickness: 1.6,
      ior: 1.45,
      transparent: true,
      opacity: 0.82,
      clearcoat: 1,
      clearcoatRoughness: 0.15,
      emissive: accentDim,
      emissiveIntensity: 0.18,
    });
    core.add(new THREE.Mesh(coreGeometry, coreMaterial));

    const wireframe = new THREE.LineSegments(
      new THREE.EdgesGeometry(coreGeometry),
      new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.45 }),
    );
    core.add(wireframe);

    // A soft halo sitting behind the core so it reads as a light source,
    // not just a shaded solid — cheap alternative to a bloom pass.
    const coreHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: particleTexture, color: accent, transparent: true, opacity: 0.5, depthWrite: false }),
    );
    coreHalo.scale.set(5.2, 5.2, 1);
    core.add(coreHalo);

    rig.add(core);

    // ----- Orbit rings + nodes: public nullifiers circling the private core,
    // each tethered back to the core by a thin "proof" line.
    const orbitGroup = new THREE.Group();
    type Orbit = { pivot: THREE.Group; speed: number; radius: number; tether: THREE.Line };
    const orbits: Orbit[] = [];

    [
      { radius: 2.3, tilt: 0.15, speed: 0.22, scale: 1.1 },
      { radius: 2.9, tilt: -0.55, speed: -0.15, scale: 0.85 },
      { radius: 2.55, tilt: 1.05, speed: 0.18, scale: 1 },
      { radius: 3.25, tilt: 0.72, speed: -0.11, scale: 0.7 },
      { radius: 2.05, tilt: -1.15, speed: 0.28, scale: 0.65 },
    ].forEach(({ radius, tilt, speed, scale }) => {
      const ringGeometry = new THREE.TorusGeometry(radius, 0.004, 8, 128);
      const ringMaterial = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.16 });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = Math.PI / 2 + tilt;
      orbitGroup.add(ring);

      const pivot = new THREE.Group();
      pivot.rotation.x = Math.PI / 2 + tilt;
      const node = new THREE.Mesh(
        new THREE.SphereGeometry(0.09 * scale, 24, 24),
        new THREE.MeshBasicMaterial({ color: accent }),
      );
      node.position.set(radius, 0, 0);
      pivot.add(node);

      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: particleTexture, color: accent, transparent: true, opacity: 0.9, depthWrite: false }),
      );
      glow.scale.set(0.9 * scale, 0.9 * scale, 1);
      glow.position.copy(node.position);
      pivot.add(glow);

      const tetherGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(radius, 0, 0)]);
      const tether = new THREE.Line(
        tetherGeometry,
        new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.12 }),
      );
      pivot.add(tether);

      orbitGroup.add(pivot);
      orbits.push({ pivot, speed, radius, tether });
    });
    rig.add(orbitGroup);

    // ----- Lighting: soft key + emerald rim, per the skill's cinematic-not-gamey brief
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const key = new THREE.DirectionalLight(0xffffff, 1);
    key.position.set(3, 4, 5);
    scene.add(key);
    const rim = new THREE.PointLight(accent, 9, 14);
    rim.position.set(-3, -1.5, -2);
    scene.add(rim);
    const fill = new THREE.PointLight(accent, 3, 10);
    fill.position.set(2, 2, 3);
    scene.add(fill);

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

      core.rotation.y = elapsed * 0.16;
      core.rotation.x = Math.sin(elapsed * 0.3) * 0.12;
      const pulse = 1 + Math.sin(elapsed * 0.8) * 0.06;
      coreHalo.scale.set(5.2 * pulse, 5.2 * pulse, 1);

      orbits.forEach(({ pivot, speed }) => {
        pivot.rotation.z = elapsed * speed;
      });

      particles.rotation.y = elapsed * 0.015;

      targetRotation.x += (pointer.y * 0.16 - targetRotation.x) * 0.04;
      targetRotation.y += (pointer.x * 0.2 - targetRotation.y) * 0.04;
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
      particleTexture.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Sprite || object instanceof THREE.Points || object instanceof THREE.Line) {
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

/** A soft radial-gradient sprite texture reused for the particle field, node glows, and the core halo — one shared texture instead of one per use. */
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
