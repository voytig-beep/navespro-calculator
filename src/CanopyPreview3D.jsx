import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, Number(value) || min));

const roofPalette = {
  cellPoly: { color: 0x8cc9ff, opacity: 0.5 },
  solidPoly: { color: 0xc9e4ff, opacity: 0.46 },
  profSheet: { color: 0x7c8588, opacity: 0.82 },
  metalTile: { color: 0x9a352c, opacity: 0.88 },
};

function clearObject(object) {
  const geometries = new Set();
  const materials = new Set();

  object.traverse((child) => {
    if (child.geometry) geometries.add(child.geometry);
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => materials.add(material));
      } else {
        materials.add(child.material);
      }
    }
  });

  object.clear();
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

function addBeam(group, start, end, thickness, material) {
  const direction = end.clone().sub(start);
  const length = direction.length();
  const geometry = new THREE.BoxGeometry(thickness, length, thickness);
  const mesh = new THREE.Mesh(geometry, material);

  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.castShadow = true;
  group.add(mesh);

  return mesh;
}

function addPlate(group, x, z, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 0.22), material);
  mesh.position.set(x, 0.02, z);
  mesh.receiveShadow = true;
  group.add(mesh);
}

function buildCanopy(group, form) {
  clearObject(group);

  const lengthMeters = clampNumber(form.length, 2, 12);
  const widthMeters = clampNumber(form.width, 2, 8);
  const heightMeters = clampNumber(form.height, 2, 4);
  const scale = 0.42;
  const length = lengthMeters * scale;
  const width = widthMeters * scale;
  const height = heightMeters * scale;
  const rise = Math.max(0.22, Math.min(0.58, width * 0.18));
  const overhang = 0.16;
  const roof = roofPalette[form.covering] || roofPalette.cellPoly;
  const frameColor = form.paint === "powder" ? 0x1d2322 : form.paint === "zinc" ? 0x58615f : 0x303737;
  const postThickness = form.frame === "premium" ? 0.108 : form.frame === "reinforced" ? 0.096 : 0.085;
  const beamThickness = postThickness + 0.012;
  const rafterThickness = form.frame === "premium" ? 0.06 : 0.052;

  const frameMaterial = new THREE.MeshStandardMaterial({ color: frameColor, metalness: 0.55, roughness: 0.28 });
  const braceMaterial = new THREE.MeshStandardMaterial({ color: 0x6f7b77, metalness: 0.45, roughness: 0.34 });
  const plateMaterial = new THREE.MeshStandardMaterial({ color: 0x242927, metalness: 0.4, roughness: 0.38 });
  const roofMaterial = new THREE.MeshPhysicalMaterial({
    color: roof.color,
    metalness: 0.02,
    opacity: roof.opacity,
    roughness: 0.18,
    side: THREE.DoubleSide,
    transparent: true,
    transmission: form.covering === "cellPoly" || form.covering === "solidPoly" ? 0.22 : 0,
  });
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xd7ff7a, transparent: true, opacity: 0.62 });

  const yAt = (z) => height + ((z + width / 2) / width) * rise;
  const xLeft = -length / 2;
  const xRight = length / 2;
  const zFront = -width / 2;
  const zBack = width / 2;

  [
    [xLeft, zFront],
    [xRight, zFront],
    [xLeft, zBack],
    [xRight, zBack],
  ].forEach(([x, z]) => {
    addBeam(group, new THREE.Vector3(x, 0.04, z), new THREE.Vector3(x, yAt(z) - 0.04, z), postThickness, frameMaterial);
    addPlate(group, x, z, plateMaterial);
  });

  addBeam(group, new THREE.Vector3(xLeft - 0.08, yAt(zFront), zFront), new THREE.Vector3(xRight + 0.08, yAt(zFront), zFront), beamThickness, frameMaterial);
  addBeam(group, new THREE.Vector3(xLeft - 0.08, yAt(zBack), zBack), new THREE.Vector3(xRight + 0.08, yAt(zBack), zBack), beamThickness, frameMaterial);
  addBeam(group, new THREE.Vector3(xLeft, yAt(zFront), zFront), new THREE.Vector3(xLeft, yAt(zBack), zBack), postThickness, frameMaterial);
  addBeam(group, new THREE.Vector3(xRight, yAt(zFront), zFront), new THREE.Vector3(xRight, yAt(zBack), zBack), postThickness, frameMaterial);

  const rafterCount = Math.max(4, Math.round(lengthMeters / 1.7) + 2);
  for (let i = 0; i < rafterCount; i += 1) {
    const x = xLeft + (length * i) / (rafterCount - 1);
    addBeam(group, new THREE.Vector3(x, yAt(zFront) - 0.04, zFront), new THREE.Vector3(x, yAt(zBack) - 0.04, zBack), rafterThickness, braceMaterial);
  }

  const purlinCount = 5;
  for (let i = 0; i < purlinCount; i += 1) {
    const z = zFront + (width * i) / (purlinCount - 1);
    addBeam(group, new THREE.Vector3(xLeft - 0.12, yAt(z) - 0.075, z), new THREE.Vector3(xRight + 0.12, yAt(z) - 0.075, z), 0.04, braceMaterial);
  }

  const segmentCount = Math.max(3, Math.round(lengthMeters / 2));
  [zFront, zBack].forEach((z) => {
    for (let i = 0; i < segmentCount; i += 1) {
      const x0 = xLeft + (length * i) / segmentCount;
      const x1 = xLeft + (length * (i + 1)) / segmentCount;
      addBeam(group, new THREE.Vector3(x0, yAt(z) - 0.45, z), new THREE.Vector3(x1, yAt(z) - 0.08, z), 0.034, braceMaterial);
    }
  });

  const roofGeometry = new THREE.BufferGeometry();
  roofGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        xLeft - overhang,
        yAt(zFront) + 0.03,
        zFront - overhang,
        xRight + overhang,
        yAt(zFront) + 0.03,
        zFront - overhang,
        xRight + overhang,
        yAt(zBack) + 0.03,
        zBack + overhang,
        xLeft - overhang,
        yAt(zBack) + 0.03,
        zBack + overhang,
      ],
      3,
    ),
  );
  roofGeometry.setIndex([0, 1, 2, 0, 2, 3]);
  roofGeometry.computeVertexNormals();

  const roofMesh = new THREE.Mesh(roofGeometry, roofMaterial);
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;
  group.add(roofMesh);

  const roofEdges = new THREE.LineSegments(new THREE.EdgesGeometry(roofGeometry), edgeMaterial);
  group.add(roofEdges);

  group.position.y = -height * 0.42;
}

export function CanopyPreview3D({ form }) {
  const mountRef = useRef(null);
  const modelRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    const controls = new OrbitControls(camera, renderer.domElement);
    const model = new THREE.Group();
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(3.8, 72),
      new THREE.MeshStandardMaterial({ color: 0x151b18, roughness: 0.88 }),
    );

    modelRef.current = model;
    scene.add(model);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x1c241f, 1.8));

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(4.2, 5.4, 3.5);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xb8ff55, 0.75);
    rimLight.position.set(-4, 2.8, -2.5);
    scene.add(rimLight);

    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.2;
    ground.receiveShadow = true;
    scene.add(ground);

    camera.position.set(2.7, 1.9, 4.1);
    controls.target.set(0, 0.05, 0);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.45;
    controls.minDistance = 2.6;
    controls.maxDistance = 6.2;

    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    const resize = () => {
      const width = Math.max(320, mount.clientWidth || 500);
      const height = Math.max(320, mount.clientHeight || 650);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    let frameId = 0;
    const render = () => {
      controls.update();
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(render);
    };
    render();

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
      controls.dispose();
      clearObject(model);
      ground.geometry.dispose();
      ground.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      modelRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (modelRef.current) buildCanopy(modelRef.current, form);
  }, [form.covering, form.frame, form.height, form.length, form.paint, form.width]);

  return <div className="model-preview" ref={mountRef} role="img" aria-label="3D модель навеса" />;
}
