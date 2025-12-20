import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { URDFRobot } from 'urdf-loader';

interface ViewerProps {
  robot: URDFRobot | null;
  showWorldAxes: boolean;
  showGrid: boolean;
  showLinkAxes: boolean;
  showJointAxes: boolean;
  showCollision: boolean;
  wireframe: boolean;
}

const Viewer: React.FC<ViewerProps> = (props) => {
  const { robot, showWorldAxes, showGrid, showLinkAxes, showJointAxes, showCollision, wireframe } = props;
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const axesRef = useRef<THREE.AxesHelper | null>(null);

  // Effect for initializing the scene
  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x263238);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 1000);
    camera.position.set(2, 2, 2);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    
    const grid = new THREE.GridHelper(20, 20);
    gridRef.current = grid;
    scene.add(grid);

    const axes = new THREE.AxesHelper(1);
    axesRef.current = axes;
    scene.add(axes);
    
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Effect for handling the robot and its display options
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    let currentRobot: URDFRobot | null = null;
    
    // Add new robot if it exists
    if (robot) {
      currentRobot = robot;
      currentRobot.rotation.x = -Math.PI / 2;
      scene.add(currentRobot);

      // Apply display options
      if (currentRobot.visual) {
        currentRobot.visual.visible = !showCollision;
      }
      if (currentRobot.collision) {
        currentRobot.collision.visible = showCollision;
      }

      for (const name in currentRobot.joints) {
        const joint = currentRobot.joints[name];
        const axes = joint.getObjectByName('axes');
        if (axes) {
          axes.visible = showJointAxes;
        }
      }

      for (const name in currentRobot.links) {
        const link = currentRobot.links[name];
        const axes = link.getObjectByName('axes');
        if (axes) {
          axes.visible = showLinkAxes;
        }
      }
      
      currentRobot.traverse(c => {
        if (c.isMesh) {
          const materials = Array.isArray(c.material) ? c.material : [c.material];
          materials.forEach(m => {
            m.wireframe = wireframe;
          });
        }
      });
    }

    // Cleanup function to remove old robot
    return () => {
      if (currentRobot) {
        scene.remove(currentRobot);
      }
    };
  }, [robot, showJointAxes, showLinkAxes, showCollision, wireframe]);

  // Effect for toggling grid and axes helpers
  useEffect(() => {
    if (gridRef.current) {
        gridRef.current.visible = showGrid;
    }
    if (axesRef.current) {
        axesRef.current.visible = showWorldAxes;
    }
  }, [showGrid, showWorldAxes]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
};

export default Viewer;
