import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { URDFRobot, URDFJoint, URDFLink } from 'urdf-loader';

interface ViewerProps {
  robot: URDFRobot | null;
  showWorldAxes: boolean;
  showGrid: boolean;
  wireframe: boolean;
  onSelectionUpdate: (name: string | null, matrix: THREE.Matrix4 | null, event?: MouseEvent) => void;
}

const Viewer: React.FC<ViewerProps> = (props) => {
  const { robot, showWorldAxes, showGrid, wireframe, onSelectionUpdate } = props;
  const mountRef = useRef<HTMLDivElement>(null);

  // Refs for three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const axesRef = useRef<THREE.AxesHelper | null>(null);
  
  // Refs for selection and highlighting
  const selectedObjectRef = useRef<URDFLink | URDFJoint | null>(null);
  const originalMaterialRef = useRef<THREE.Material | THREE.Material[] | null>(null);
  const highlightMaterialRef = useRef(new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true }));

  const unhighlight = () => {
    if (selectedObjectRef.current && originalMaterialRef.current) {
      // Find the mesh to unhighlight
      const mesh = selectedObjectRef.current.getObjectByProperty('isMesh', true);
      if (mesh) {
        (mesh as THREE.Mesh).material = originalMaterialRef.current as THREE.Material;
      }
    }
    selectedObjectRef.current = null;
    originalMaterialRef.current = null;
  };
  
  // Main initialization effect (runs once)
  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x263238);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 1000);
    camera.position.set(1.5, 1.5, 1.5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Lights and helpers
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    
    gridRef.current = new THREE.GridHelper(20, 20);
    scene.add(gridRef.current);
    axesRef.current = new THREE.AxesHelper(1);
    scene.add(axesRef.current);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();

      // Real-time matrix update for selected object
      if (selectedObjectRef.current) {
        selectedObjectRef.current.updateWorldMatrix(true, false);
        onSelectionUpdate(selectedObjectRef.current.name, selectedObjectRef.current.matrixWorld);
      }

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => { /* ... resize logic ... */ };
    window.addEventListener('resize', handleResize);

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      if (!mountRef.current) return;

      const rect = mountRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);
      
      unhighlight(); // Always unhighlight previous selection

      for (const intersect of intersects) {
        let object: THREE.Object3D | null = intersect.object;
        while (object) {
          if ((object as any).isURDFLink || (object as any).isURDFJoint) {
            const selected = object as URDFLink | URDFJoint;
            
            // Highlight logic
            const mesh = selected.getObjectByProperty('isMesh', true);
            if (mesh) {
              selectedObjectRef.current = selected;
              originalMaterialRef.current = (mesh as THREE.Mesh).material;
              (mesh as THREE.Mesh).material = highlightMaterialRef.current;
            }
            
            onSelectionUpdate(selected.name, selected.matrixWorld, event);
            return;
          }
          object = object.parent;
        }
      }
      // If no link/joint was clicked, clear the selection
      onSelectionUpdate(null, null, event);
    };
    mountRef.current.addEventListener('contextmenu', handleContextMenu);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (mountRef.current) {
        mountRef.current.removeEventListener('contextmenu', handleContextMenu);
        if (renderer.domElement) {
          mountRef.current.removeChild(renderer.domElement);
        }
      }
    };
  }, []); // This effect runs only once on mount

  // Effect for adding and removing the robot from the scene
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    unhighlight(); // Unhighlight when robot changes
    onSelectionUpdate(null, null);

    if (robot) {
      robot.rotation.x = -Math.PI / 2;
      scene.add(robot);
      return () => {
        scene.remove(robot);
      }
    }
  }, [robot]);

  // Other effects for toggling wireframe, grid, axes...
  useEffect(() => {
    if (robot) {
        robot.traverse(c => {
            if (c.isMesh && c !== selectedObjectRef.current?.getObjectByProperty('isMesh', true)) {
              const materials = Array.isArray(c.material) ? c.material : [c.material];
              materials.forEach(m => { m.wireframe = wireframe; });
            }
        });
    }
  }, [robot, wireframe]);

  useEffect(() => {
    if (gridRef.current) gridRef.current.visible = showGrid;
    if (axesRef.current) axesRef.current.visible = showWorldAxes;
  }, [showGrid, showWorldAxes]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
};

export default Viewer;
