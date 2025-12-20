import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { URDFRobot, URDFJoint, URDFLink } from 'urdf-loader';

interface ViewerProps {
  robot: URDFRobot | null;
  isCtrlPressed: boolean;
  selectedLinkName: string | null;
  selectedJoint: URDFJoint | null;
  showWorldAxes: boolean;
  showGrid: boolean;
  showLinkAxes: boolean;
  showJointAxes: boolean;
  wireframe: boolean;
  onSelectionUpdate: (name: string | null, matrix: THREE.Matrix4 | null, parentMatrix: THREE.Matrix4 | null) => void;
  onJointSelect: (joint: URDFJoint) => void;
  onJointChange: (name: string, value: number) => void;
  onMatrixUpdate: (matrix: THREE.Matrix4) => void;
}

const Viewer: React.FC<ViewerProps> = (props) => {
  const { robot, isCtrlPressed, selectedLinkName, selectedJoint, showWorldAxes, showGrid, showLinkAxes, showJointAxes, wireframe, onSelectionUpdate, onJointSelect, onJointChange, onMatrixUpdate } = props;
  const mountRef = useRef<HTMLDivElement>(null);

  // Refs for three.js objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const axesRef = useRef<THREE.AxesHelper | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  
  // Refs for selection and highlighting (LINK)
  const selectedLinkRef = useRef<URDFLink | null>(null);
  const selectedLinkParentRef = useRef<URDFLink | null>(null);
  const originalLinkMaterialRef = useRef<THREE.Material | THREE.Material[] | null>(null);
  const linkHighlightMaterialRef = useRef(new THREE.MeshBasicMaterial({ 
    color: 0xffff00, 
    transparent: true, 
    opacity: 0.5,
    depthTest: false 
  }));

  // --- DRAGGING STATE ---
  const dragInfoRef = useRef<{
      joint: URDFJoint;
      startValue: number;
      startMouseX: number;
      startMouseY: number;
      draggedMesh: THREE.Mesh | null;
      originalMaterial: THREE.Material | THREE.Material[] | null;
      worldClickPoint: THREE.Vector3; // The exact point captured on mousedown
  } | null>(null);

  // Refs for selection and highlighting (JOINT)
  const selectedJointHelperRef = useRef<THREE.Mesh | null>(null);
  const originalJointMaterialRef = useRef<THREE.Material | THREE.Material[] | null>(null);
  const jointHighlightMaterialRef = useRef(new THREE.MeshBasicMaterial({ 
    color: 0x00ffff, // Cyan for joints
    transparent: true, 
    opacity: 0.8,
    depthTest: false 
  }));

  // IMPORTANT: Use refs to avoid stale closures in event handlers/animate loop
  const onMatrixUpdateRef = useRef(onMatrixUpdate);
  const onSelectionUpdateRef = useRef(onSelectionUpdate);
  const onJointSelectRef = useRef(onJointSelect);
  const onJointChangeRef = useRef(onJointChange);
  const isCtrlPressedRef = useRef(isCtrlPressed);
  const robotRef = useRef<URDFRobot | null>(robot);
  
  useEffect(() => { onMatrixUpdateRef.current = onMatrixUpdate; }, [onMatrixUpdate]);
  useEffect(() => { onSelectionUpdateRef.current = onSelectionUpdate; }, [onSelectionUpdate]);
  useEffect(() => { onJointSelectRef.current = onJointSelect; }, [onJointSelect]);
  useEffect(() => { onJointChangeRef.current = onJointChange; }, [onJointChange]);
  useEffect(() => { isCtrlPressedRef.current = isCtrlPressed; }, [isCtrlPressed]);
  useEffect(() => { robotRef.current = robot; }, [robot]);

  const unhighlightLink = () => {
    if (selectedLinkRef.current && originalLinkMaterialRef.current) {
      const mesh = selectedLinkRef.current.getObjectByProperty('isMesh', true) as THREE.Mesh;
      if (mesh) {
        mesh.material = originalLinkMaterialRef.current as THREE.Material;
      }
    }
    selectedLinkRef.current = null;
    selectedLinkParentRef.current = null;
    originalLinkMaterialRef.current = null;
  };

  const unhighlightJoint = () => {
    if (selectedJointHelperRef.current && originalJointMaterialRef.current) {
      selectedJointHelperRef.current.material = originalJointMaterialRef.current as THREE.Material;
    }
    selectedJointHelperRef.current = null;
    originalJointMaterialRef.current = null;
  };

  // Handle external joint selection (highlighting the JOINT HELPER)
  useEffect(() => {
      unhighlightJoint();
      if (selectedJoint) {
          // Find the joint-helper mesh
          const helper = selectedJoint.children.find(c => c.name === 'joint-helper') as THREE.Mesh;
          if (helper) {
              selectedJointHelperRef.current = helper;
              originalJointMaterialRef.current = helper.material;
              helper.material = jointHighlightMaterialRef.current;
          }
      }
  }, [selectedJoint]);

  // Sync internal link selection with prop (e.g. when closed from UI)
  useEffect(() => {
      if (selectedLinkName === null && selectedLinkRef.current !== null) {
          unhighlightLink();
      }
  }, [selectedLinkName]);
  
  // 1. Scene Initialization
  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x263238);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 1000);
    camera.position.set(1.5, 1.5, 1.5);
    camera.up.set(0, 0, 1);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);
    
    gridRef.current = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
    gridRef.current.rotation.x = Math.PI / 2;
    scene.add(gridRef.current);
    axesRef.current = new THREE.AxesHelper(1);
    scene.add(axesRef.current);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();

      if (selectedLinkRef.current) {
        selectedLinkRef.current.updateWorldMatrix(true, false);
        
        let parentMatrix: THREE.Matrix4 | null = null;
        if (selectedLinkParentRef.current) {
            selectedLinkParentRef.current.updateWorldMatrix(true, false);
            parentMatrix = selectedLinkParentRef.current.matrixWorld.clone();
        }

        // Clone the matrix to force React state update (Three.js reuses the instance)
        onSelectionUpdateRef.current(
            selectedLinkRef.current.name, 
            selectedLinkRef.current.matrixWorld.clone(),
            parentMatrix
        );
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

    // --- INTERACTION HANDLERS ---

    const getLinkFromEvent = (event: MouseEvent): URDFLink | null => {
        if (!mountRef.current || !camera || !robotRef.current) return null;
        
        const rect = mountRef.current.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        raycaster.setFromCamera({ x, y }, camera);
        const intersects = raycaster.intersectObject(robotRef.current, true);

        // Search through ALL intersects to find the first valid Link
        for (const intersect of intersects) {
            let object: THREE.Object3D | null = intersect.object;
            
            // Skip helper objects
            if (object.name.includes('helper') || object.name.includes('axes')) continue;

            while (object) {
                if ((object as any).isURDFLink) return object as URDFLink;
                object = object.parent;
            }
        }
        return null;
    };

    const handleMouseMoveHover = (event: MouseEvent) => {
        if (dragInfoRef.current) return; // Don't change cursor during drag
        
        const link = getLinkFromEvent(event);
        if (mountRef.current) {
            mountRef.current.style.cursor = link ? 'pointer' : 'default';
        }
    };

    const handleMouseDown = (event: MouseEvent) => {
        // Only handle LEFT click for dragging
        if (event.button !== 0 || isCtrlPressedRef.current) return;
        if (!mountRef.current || !camera || !robotRef.current) return;

        const rect = mountRef.current.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        raycaster.setFromCamera({ x, y }, camera);
        const intersects = raycaster.intersectObject(robotRef.current, true);

        // Find the link
        let link: URDFLink | null = null;
        let intersectPoint: THREE.Vector3 | null = null;

        for (const intersect of intersects) {
            let object: THREE.Object3D | null = intersect.object;
            if (object.name.includes('helper') || object.name.includes('axes')) continue;

            while (object) {
                if ((object as any).isURDFLink) {
                    link = object as URDFLink;
                    intersectPoint = intersect.point;
                    break;
                }
                object = object.parent;
            }
            if (link) break;
        }

        if (link && link.parent && (link.parent as any).isURDFJoint && intersectPoint) {
            const joint = link.parent as URDFJoint;
            if (joint.jointType !== 'fixed') {
                const mesh = link.getObjectByProperty('isMesh', true) as THREE.Mesh;
                let originalMaterial = null;
                if (mesh) {
                    originalMaterial = mesh.material;
                    mesh.material = linkHighlightMaterialRef.current;
                }

                dragInfoRef.current = {
                    joint: joint,
                    startValue: joint.angle as number || 0,
                    startMouseX: event.clientX,
                    startMouseY: event.clientY,
                    draggedMesh: mesh,
                    originalMaterial: originalMaterial,
                    worldClickPoint: intersectPoint.clone()
                };
                
                if (controlsRef.current) controlsRef.current.enabled = false;
            }
        }
    };

    const handleMouseMoveGlobal = (event: MouseEvent) => {
        if (!dragInfoRef.current || !camera || !rendererRef.current) return;

        const { joint, startValue, startMouseX, startMouseY, worldClickPoint } = dragInfoRef.current;
        
        // 1. Get raw pixel movement from the start
        const dx = event.clientX - startMouseX;
        const dy = event.clientY - startMouseY;
        const mouseMovePixels = new THREE.Vector2(dx, dy);

        // 2. Calculate the 3D direction the link wants to move (unit change)
        const jointWorldPos = new THREE.Vector3().setFromMatrixPosition(joint.matrixWorld);
        const jointAxisWorld = new THREE.Vector3().copy(joint.axis || new THREE.Vector3(0, 0, 1))
            .transformDirection(joint.matrixWorld);
        
        let moveDir3D = new THREE.Vector3();
        if (joint.jointType === 'revolute' || joint.jointType === 'continuous') {
            const relPoint = new THREE.Vector3().subVectors(worldClickPoint, jointWorldPos);
            // Tangent vector = axis x radius (This represents the motion for 1 radian)
            moveDir3D.crossVectors(jointAxisWorld, relPoint); 
        } else {
            // Motion for 1 meter
            moveDir3D.copy(jointAxisWorld);
        }

        // 3. Project that 3D "1-unit move" to screen space (Pixels)
        const rect = rendererRef.current.domElement.getBoundingClientRect();
        const p1 = worldClickPoint.clone().project(camera);
        const p2 = worldClickPoint.clone().add(moveDir3D).project(camera);
        
        const screenMotionVec = new THREE.Vector2(
            (p2.x - p1.x) * rect.width / 2,
            -(p2.y - p1.y) * rect.height / 2
        );

        // 4. Dot product: project mouse movement onto the screen motion vector
        const projectionLenSq = screenMotionVec.lengthSq();
        if (projectionLenSq < 0.0001) return; // Prevent division by zero

        const change = mouseMovePixels.dot(screenMotionVec) / projectionLenSq;
        let newValue = startValue + change;

        // Apply limits
        if (joint.limit) {
            const min = Number(joint.limit.lower);
            const max = Number(joint.limit.upper);
            if (!isNaN(min) && !isNaN(max)) {
                newValue = Math.max(min, Math.min(max, newValue));
            }
        }

        onJointChangeRef.current(joint.name, newValue);
    };

    const handleMouseUpGlobal = () => {
        if (dragInfoRef.current) {
            const { draggedMesh, originalMaterial } = dragInfoRef.current as any;
            // Restore original material
            if (draggedMesh && originalMaterial) {
                draggedMesh.material = originalMaterial;
            }
            
            dragInfoRef.current = null;
            if (controlsRef.current) controlsRef.current.enabled = true;
        }
    };

    // Force exit drag mode if window loses focus
    window.addEventListener('blur', handleMouseUpGlobal);

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      if (!mountRef.current || !camera || !robotRef.current) return;

      const rect = mountRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      
      // Raycast ONLY against the robot model to avoid hitting the grid/axes
      const intersects = raycaster.intersectObject(robotRef.current, true);
      
      // --- CTRL KEY LOGIC: Joint Selection ---
      if (isCtrlPressedRef.current) {
          if (intersects.length > 0) {
              // 1. Try to find if we hit a joint helper directly
              const helperIntersect = intersects.find(i => i.object.name === 'joint-helper');
              if (helperIntersect) {
                  const joint = helperIntersect.object.parent as URDFJoint;
                  if (joint && (joint as any).isURDFJoint && joint.jointType !== 'fixed') {
                      onJointSelectRef.current(joint);
                      return;
                  }
              }

              // 2. Fallback: If we hit a mesh, find the Link and then its parent Joint
              let object = intersects[0].object;
              let link: URDFLink | null = null;
              while (object) {
                  if ((object as any).isURDFLink) {
                      link = object as URDFLink;
                      break;
                  }
                  object = object.parent as THREE.Object3D;
              }

              if (link && link.parent && (link.parent as any).isURDFJoint) {
                  const joint = link.parent as URDFJoint;
                  if (joint.jointType !== 'fixed') {
                     onJointSelectRef.current(joint);
                  }
              }
          }
          return; 
      }

      // --- STANDARD LOGIC: Link/Part Selection ---
      let newSelection: URDFLink | null = null;
      for (const intersect of intersects) {
        let object: THREE.Object3D | null = intersect.object;
        
        // Skip helper objects
        if (object.name === 'joint-helper' || object.name === 'axes-helper-link' || object.name === 'axes-helper-joint') {
            continue;
        }

        while (object) {
          if ((object as any).isURDFLink) {
            newSelection = object as URDFLink;
            break;
          }
          object = object.parent;
        }
        
        if (newSelection) break;
      }

      if (newSelection && newSelection === selectedLinkRef.current) {
        unhighlightLink();
        onSelectionUpdateRef.current(null, null, null);
      } else {
        unhighlightLink();
        if (newSelection) {
            const mesh = newSelection.getObjectByProperty('isMesh', true) as THREE.Mesh;
            if (mesh) {
              selectedLinkRef.current = newSelection;
              originalLinkMaterialRef.current = mesh.material;
              mesh.material = linkHighlightMaterialRef.current;

              // Find Parent Link
              let parentLink: URDFLink | null = null;
              let p = newSelection.parent;
              while(p) {
                  if ((p as any).isURDFLink) {
                      parentLink = p as URDFLink;
                      break;
                  }
                  p = p.parent;
              }
              selectedLinkParentRef.current = parentLink;
              
              let parentMatrix: THREE.Matrix4 | null = null;
              if (parentLink) {
                  parentLink.updateWorldMatrix(true, false);
                  parentMatrix = parentLink.matrixWorld.clone();
              }

              onSelectionUpdateRef.current(newSelection.name, newSelection.matrixWorld.clone(), parentMatrix);
            } else {
                onSelectionUpdateRef.current(null, null, null);
            }
        } else {
            onSelectionUpdateRef.current(null, null, null);
        }
      }
    };
    mountRef.current.addEventListener('mousedown', handleMouseDown);
    mountRef.current.addEventListener('mousemove', handleMouseMoveHover);
    window.addEventListener('mousemove', handleMouseMoveGlobal);
    window.addEventListener('mouseup', handleMouseUpGlobal);
    mountRef.current.addEventListener('contextmenu', handleContextMenu);
    
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (mountRef.current) {
        mountRef.current.removeEventListener('mousedown', handleMouseDown);
        mountRef.current.removeEventListener('mousemove', handleMouseMoveHover);
        mountRef.current.removeEventListener('contextmenu', handleContextMenu);
        if (renderer.domElement) {
          mountRef.current.removeChild(renderer.domElement);
        }
      }
      window.removeEventListener('mousemove', handleMouseMoveGlobal);
      window.removeEventListener('mouseup', handleMouseUpGlobal);
      window.removeEventListener('blur', handleMouseUpGlobal);
      renderer.dispose();
    };
  }, []);

  // 2. Robot Management
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    
    unhighlightLink();
    unhighlightJoint();
    onSelectionUpdateRef.current(null, null, null);

    if (robot) {
      scene.add(robot);
      return () => {
        scene.remove(robot);
      }
    }
  }, [robot]);

  // 3. Display Toggles
  useEffect(() => {
    const effectiveShowJointAxes = showJointAxes || isCtrlPressed;

    if (robot) {
        // Wireframe
        robot.traverse(c => {
            const mesh = c.getObjectByProperty('isMesh', true) as THREE.Mesh;
            if (mesh && 
                mesh.material !== linkHighlightMaterialRef.current && 
                mesh.material !== jointHighlightMaterialRef.current) {
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
                
                if (effectiveShowJointAxes && !helper) {
                    const material = new THREE.MeshBasicMaterial({ 
                        color: 0xffaa00, 
                        transparent: true, 
                        opacity: 0.8,
                        depthTest: false // Make it visible through parts
                    });
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
                
                if (helper) helper.visible = effectiveShowJointAxes;
            }
        });
    }
  }, [robot, wireframe, showLinkAxes, showJointAxes, isCtrlPressed]);

  useEffect(() => {
    if (gridRef.current) gridRef.current.visible = showGrid;
    if (axesRef.current) axesRef.current.visible = showWorldAxes;
  }, [showGrid, showWorldAxes]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
};

export default Viewer;