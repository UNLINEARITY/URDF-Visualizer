import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { URDFRobot, URDFJoint, URDFLink } from 'urdf-loader';

interface ViewerProps {
  robot: URDFRobot | null;
  showWorldAxes: boolean;
  showGrid: boolean;
  showLinkAxes: boolean;
  showJointAxes: boolean;
  wireframe: boolean;
  onSelectionUpdate: (name: string | null, matrix: THREE.Matrix4 | null) => void;
  onMatrixUpdate: (matrix: THREE.Matrix4) => void;
}

const Viewer: React.FC<ViewerProps> = (props) => {
  const { robot, showWorldAxes, showGrid, showLinkAxes, showJointAxes, wireframe, onSelectionUpdate, onMatrixUpdate } = props;
  const mountRef = useRef<HTMLDivElement>(null);

  // Refs for three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const axesRef = useRef<THREE.AxesHelper | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  
  // Refs for selection and highlighting
  const selectedObjectRef = useRef<URDFLink | URDFJoint | null>(null);
  const originalMaterialRef = useRef<THREE.Material | THREE.Material[] | null>(null);
  const highlightMaterialRef = useRef(new THREE.MeshBasicMaterial({ 
    color: 0xffff00, 
    transparent: true, 
    opacity: 0.5,
    depthTest: false // Make it visible through other objects
  }));

  // IMPORTANT: Use refs to avoid stale closures in event handlers/animate loop
  const onMatrixUpdateRef = useRef(onMatrixUpdate);
  const onSelectionUpdateRef = useRef(onSelectionUpdate);
  const robotRef = useRef<URDFRobot | null>(robot);
  
  useEffect(() => { onMatrixUpdateRef.current = onMatrixUpdate; }, [onMatrixUpdate]);
  useEffect(() => { onSelectionUpdateRef.current = onSelectionUpdate; }, [onSelectionUpdate]);
  useEffect(() => { robotRef.current = robot; }, [robot]);

  const unhighlight = () => {
    if (selectedObjectRef.current && originalMaterialRef.current) {
      const mesh = selectedObjectRef.current.getObjectByProperty('isMesh', true) as THREE.Mesh;
      if (mesh) {
        mesh.material = originalMaterialRef.current as THREE.Material;
      }
    }
    selectedObjectRef.current = null;
    originalMaterialRef.current = null;
  };
  
  // 1. Scene Initialization
  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x263238);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 1000);
    camera.position.set(1.5, 1.5, 1.5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);
    
    gridRef.current = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
    scene.add(gridRef.current);
    axesRef.current = new THREE.AxesHelper(1);
    scene.add(axesRef.current);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();

      if (selectedObjectRef.current) {
        selectedObjectRef.current.updateWorldMatrix(true, false);
        onMatrixUpdateRef.current(selectedObjectRef.current.matrixWorld);
      }

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current || !camera || !renderer) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      if (!mountRef.current || !camera || !robotRef.current) return;

      const rect = mountRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      
      // Raycast ONLY against the robot model to avoid hitting the grid/axes
      const intersects = raycaster.intersectObject(robotRef.current, true);

      let newSelection: URDFLink | URDFJoint | null = null;
      for (const intersect of intersects) {
        let object: THREE.Object3D | null = intersect.object;
        
        // Skip helper objects (axes, joint visuals, etc.)
        // We can identify them by checking if they are the highlighting mesh 
        // or if they have specific names we assigned like 'joint-helper'
        if (object.name === 'joint-helper' || object.name === 'axes-helper-link' || object.name === 'axes-helper-joint') {
            continue;
        }

        while (object) {
          if ((object as any).isURDFLink || (object as any).isURDFJoint) {
            newSelection = object as URDFLink | URDFJoint;
            break;
          }
          object = object.parent;
        }
        
        if (newSelection) break;
      }

      if (newSelection && newSelection === selectedObjectRef.current) {
        unhighlight();
        onSelectionUpdateRef.current(null, null);
      } else {
        unhighlight();
        if (newSelection) {
            const mesh = newSelection.getObjectByProperty('isMesh', true) as THREE.Mesh;
            if (mesh) {
              selectedObjectRef.current = newSelection;
              originalMaterialRef.current = mesh.material;
              mesh.material = highlightMaterialRef.current;
            }
            onSelectionUpdateRef.current(newSelection.name, newSelection.matrixWorld);
        } else {
            onSelectionUpdateRef.current(null, null);
        }
      }
    };
    mountRef.current.addEventListener('contextmenu', handleContextMenu);
    
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (mountRef.current) {
        mountRef.current.removeEventListener('contextmenu', handleContextMenu);
        if (renderer.domElement) {
          mountRef.current.removeChild(renderer.domElement);
        }
      }
      renderer.dispose();
    };
  }, []);

  // 2. Robot Management
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    
    unhighlight();
    onSelectionUpdateRef.current(null, null);

    if (robot) {
      robot.rotation.x = -Math.PI / 2;
      scene.add(robot);
      return () => {
        scene.remove(robot);
      }
    }
  }, [robot]);

  // 3. Display Toggles
  useEffect(() => {
    if (robot) {
        // Wireframe
        robot.traverse(c => {
            const mesh = c.getObjectByProperty('isMesh', true) as THREE.Mesh;
            if (mesh && mesh.material !== highlightMaterialRef.current) {
              const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              materials.forEach(m => { m.wireframe = wireframe; });
            }
        });

        // Link Axes
        robot.traverse(c => {
            if ((c as any).isURDFLink) {
                let axes = c.children.find(child => child.name === 'axes-helper-link');
                if (showLinkAxes && !axes) {
                    axes = new THREE.AxesHelper(0.2); // Larger for links
                    axes.name = 'axes-helper-link';
                    c.add(axes);
                }
                if (axes) axes.visible = showLinkAxes;
            }
        });

        // Joint Visuals (Custom Shapes)
        robot.traverse(c => {
            if ((c as any).isURDFJoint) {
                const joint = c as URDFJoint;
                let helper = joint.children.find(child => child.name === 'joint-helper');
                
                if (showJointAxes && !helper) {
                    const material = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.8 });
                    let geometry: THREE.BufferGeometry;

                    if (joint.jointType === 'revolute' || joint.jointType === 'continuous') {
                        // Cylinder for rotation: radius 0.05, height 0.02. Default is Y-up.
                        geometry = new THREE.CylinderGeometry(0.05, 0.05, 0.02, 16);
                    } else if (joint.jointType === 'prismatic') {
                        // Box for translation: thin along Y (to match default alignment logic)
                        geometry = new THREE.BoxGeometry(0.03, 0.1, 0.03);
                    } else {
                        // Sphere for fixed/others
                        geometry = new THREE.SphereGeometry(0.03, 16, 16);
                    }

                    helper = new THREE.Mesh(geometry, material);
                    helper.name = 'joint-helper';

                    // Align helper with the joint's axis
                    // URDF joints define an axis (default is 1,0,0 or 0,0,1 depending on parser, but usually available)
                    if (joint.axis) {
                        const axis = new THREE.Vector3().copy(joint.axis).normalize();
                        const defaultUp = new THREE.Vector3(0, 1, 0); // Three.js Cylinder/Box default orientation
                        helper.quaternion.setFromUnitVectors(defaultUp, axis);
                    }

                    joint.add(helper);
                }
                
                if (helper) helper.visible = showJointAxes;
            }
        });
    }
  }, [robot, wireframe, showLinkAxes, showJointAxes]);

  useEffect(() => {
    if (gridRef.current) gridRef.current.visible = showGrid;
    if (axesRef.current) axesRef.current.visible = showWorldAxes;
  }, [showGrid, showWorldAxes]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
};

export default Viewer;