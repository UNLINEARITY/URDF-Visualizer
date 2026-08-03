import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { URDFRobot, URDFJoint, URDFLink } from 'urdf-loader';
import { disposeObject3D } from '../utils/robotLoader';
import { isURDFLink, isURDFJoint, findParentLink, isHelperObject } from '../utils/urdfTypes';
import { applyPointDensity } from '../utils/pointCloud';

interface ViewerProps {
  robot: URDFRobot | null;
  isCtrlPressed: boolean;
  selectedLinkName: string | null;
  selectedJoint: URDFJoint | null;
  /** When true the link InfoPopup is shown, so live matrix updates are pushed. */
  linkPopupVisible?: boolean;
  showWorldAxes: boolean;
  showGrid: boolean;
  showLinkAxes: boolean;
  showJointAxes: boolean;
  showShadows: boolean;
  wireframe: boolean;
  /** Point-cloud point size multiplier (1 = the auto-computed size from the loader). */
  pointSize?: number;
  /** Point-cloud density (0–1) for subsampling; 1 renders the full cloud. */
  pointDensity?: number;
  onSelectionUpdate: (
    name: string | null,
    matrix: THREE.Matrix4 | null,
    parentMatrix: THREE.Matrix4 | null,
  ) => void;
  onJointSelect: (joint: URDFJoint) => void;
  onJointChange: (name: string, value: number) => void;
  isMeasurementMode: boolean;
  measurementPoints: THREE.Vector3[];
  onMeasurementClick: (point: THREE.Vector3) => void;
  onMeasurementRemove: (index: number) => void;
  /** Reframe the camera after loading a model. */
  autoFrame?: boolean;
}

const MIN_MATRIX_PUSH_INTERVAL_MS = 66; // ~15Hz throttle for live popup updates

/** Find the first URDF link with the given name. Extracted so TS keeps a stable return type. */
function findLinkByName(root: THREE.Object3D, name: string): URDFLink | null {
  let result: URDFLink | null = null;
  root.traverse((c) => {
    if (!result && isURDFLink(c) && c.name === name) {
      result = c;
    }
  });
  return result;
}

const Viewer: React.FC<ViewerProps> = (props) => {
  const {
    robot,
    isCtrlPressed,
    selectedLinkName,
    selectedJoint,
    linkPopupVisible = false,
    showWorldAxes,
    showGrid,
    showLinkAxes,
    showJointAxes,
    showShadows,
    wireframe,
    pointSize = 1,
    pointDensity = 1,
    onSelectionUpdate,
    onJointSelect,
    onJointChange,
    isMeasurementMode,
    measurementPoints,
    onMeasurementClick,
    onMeasurementRemove,
    autoFrame = false,
  } = props;
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
  const linkHighlightMaterialRef = useRef(
    new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.5,
      depthTest: false,
    }),
  );

  // --- DRAGGING STATE ---
  const dragInfoRef = useRef<{
    mode: 'rotational_plane' | 'projection';
    joint: URDFJoint;
    startValue: number;
    draggedMesh: THREE.Mesh | null;
    originalMaterial: THREE.Material | THREE.Material[] | null;

    // Data for 'rotational_plane' mode
    plane?: THREE.Plane;
    jointAxis?: THREE.Vector3;
    jointWorldPos?: THREE.Vector3;
    startVector?: THREE.Vector3; // Vector from Center to StartClick
    previousVector?: THREE.Vector3;
    currentJointValue?: number;

    // Data for 'projection' mode (fallback & prismatic)
    startMouseX?: number;
    startMouseY?: number;
    worldClickPoint?: THREE.Vector3;
  } | null>(null);

  // Refs for selection and highlighting (JOINT)
  const selectedJointHelperRef = useRef<THREE.Mesh | null>(null);
  const originalJointMaterialRef = useRef<THREE.Material | THREE.Material[] | null>(null);
  const jointHighlightMaterialRef = useRef(
    new THREE.MeshBasicMaterial({
      color: 0x00ffff, // Cyan for joints
      transparent: true,
      opacity: 0.8,
      depthTest: false,
    }),
  );

  // IMPORTANT: Use refs to avoid stale closures in event handlers/animate loop
  const onSelectionUpdateRef = useRef(onSelectionUpdate);
  const onJointSelectRef = useRef(onJointSelect);
  const onJointChangeRef = useRef(onJointChange);
  const isCtrlPressedRef = useRef(isCtrlPressed);
  const robotRef = useRef<URDFRobot | null>(robot);
  // True only for real URDF models — standalone STL/STEP/PLY have no selectable
  // links/joints, so we skip per-frame raycasting for them entirely (O(n) on point clouds).
  const isURDFModelRef = useRef(robot ? robot.isURDFRobot === true : false);
  const isMeasurementModeRef = useRef(isMeasurementMode);
  const onMeasurementClickRef = useRef(onMeasurementClick);
  const onMeasurementRemoveRef = useRef(onMeasurementRemove);
  const measurementGroupRef = useRef<THREE.Group | null>(null);
  const linkPopupVisibleRef = useRef(linkPopupVisible);
  const lastMatrixPushRef = useRef(0);

  useEffect(() => {
    onSelectionUpdateRef.current = onSelectionUpdate;
  }, [onSelectionUpdate]);
  useEffect(() => {
    onJointSelectRef.current = onJointSelect;
  }, [onJointSelect]);
  useEffect(() => {
    onJointChangeRef.current = onJointChange;
  }, [onJointChange]);
  useEffect(() => {
    isCtrlPressedRef.current = isCtrlPressed;
  }, [isCtrlPressed]);
  useEffect(() => {
    robotRef.current = robot;
    isURDFModelRef.current = robot ? robot.isURDFRobot === true : false;
  }, [robot]);
  useEffect(() => {
    isMeasurementModeRef.current = isMeasurementMode;
  }, [isMeasurementMode]);
  useEffect(() => {
    onMeasurementClickRef.current = onMeasurementClick;
  }, [onMeasurementClick]);
  useEffect(() => {
    onMeasurementRemoveRef.current = onMeasurementRemove;
  }, [onMeasurementRemove]);
  useEffect(() => {
    linkPopupVisibleRef.current = linkPopupVisible;
  }, [linkPopupVisible]);

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
      const helper = selectedJoint.children.find((c) => c.name === 'joint-helper') as THREE.Mesh;
      if (helper) {
        selectedJointHelperRef.current = helper;
        originalJointMaterialRef.current = helper.material;
        helper.material = jointHighlightMaterialRef.current;
      }
    }
  }, [selectedJoint]);

  // Sync internal link selection with prop
  useEffect(() => {
    // 1. If we are already selecting this link, do nothing
    if (selectedLinkRef.current && selectedLinkRef.current.name === selectedLinkName) {
      return;
    }

    // 2. Unhighlight current
    unhighlightLink();

    // 3. Highlight new if exists
    if (selectedLinkName && robot) {
      const foundLink = findLinkByName(robot, selectedLinkName);

      if (foundLink) {
        const link = foundLink;
        const mesh = link.getObjectByProperty('isMesh', true) as THREE.Mesh;

        if (mesh) {
          selectedLinkRef.current = link;
          originalLinkMaterialRef.current = mesh.material;
          mesh.material = linkHighlightMaterialRef.current;
          // Parent is the one driving selection; no notify needed here.
        }
      }
    }
  }, [selectedLinkName, robot]);

  // 1. Scene Initialization
  useEffect(() => {
    if (!mountRef.current) return;

    // Capture stable ref values up front so the cleanup closure reads locals,
    // not ref.current (eslint react-hooks/exhaustive-deps best practice).
    const mountNode = mountRef.current;
    const linkHighlightMat = linkHighlightMaterialRef.current;
    const jointHighlightMat = jointHighlightMaterialRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x263238);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000,
    );
    camera.position.set(1.5, 1.5, 1.5);
    camera.up.set(0, 0, 1);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // --- EVENT INTERCEPTOR FOR CTRL+CLICK ROTATION ---
    // User holds Ctrl to pass through StructureTree, but wants standard Rotation (not Pan).
    // OrbitControls reads event.ctrlKey. We capture the event and force ctrlKey to false
    // for the OrbitControls logic, while keeping isCtrlPressedRef true for our own logic.
    // 1. Capture Phase: Modify event properties (strip Ctrl) BEFORE OrbitControls sees them
    const stripCtrlKey = (e: MouseEvent | PointerEvent) => {
      if (e.ctrlKey) {
        Object.defineProperty(e, 'ctrlKey', { get: () => false });
      }
    };

    // 2. Bubble Phase: Stop propagation AFTER OrbitControls has used the event
    // This prevents the event from reaching document/window where plugins live
    const stopBubble = (e: MouseEvent | PointerEvent) => {
      if (e.buttons & 2 || e.button === 2) {
        // Right click
        e.stopPropagation();
      }
    };

    // Attach Interceptors
    renderer.domElement.addEventListener('pointerdown', stripCtrlKey, { capture: true });
    renderer.domElement.addEventListener('pointermove', stripCtrlKey, { capture: true });
    renderer.domElement.addEventListener('pointerup', stripCtrlKey, { capture: true });

    // Also attach stopPropagation listeners for right-click dragging
    // Important: capture=false (default) so it runs at Target/Bubble phase
    renderer.domElement.addEventListener('mousedown', stopBubble);
    renderer.domElement.addEventListener('mousemove', stopBubble);
    renderer.domElement.addEventListener('mouseup', stopBubble);
    renderer.domElement.addEventListener('pointerdown', stopBubble);
    renderer.domElement.addEventListener('pointermove', stopBubble);
    renderer.domElement.addEventListener('pointerup', stopBubble);

    // Legacy listeners for strict click logic
    renderer.domElement.addEventListener('mousedown', stripCtrlKey, { capture: true });
    renderer.domElement.addEventListener('mousemove', stripCtrlKey, { capture: true });
    renderer.domElement.addEventListener('mouseup', stripCtrlKey, { capture: true });

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;

    const updateCameraClipping = () => {
      const distance = camera.position.distanceTo(controls.target);
      if (!Number.isFinite(distance) || distance <= 0) return;

      // Keep the near plane close enough for inspection while maintaining a
      // stable near/far ratio for the depth buffer.
      const near = Math.max(0.00001, distance / 100);
      const far = Math.max(10, distance * 100);
      if (
        Math.abs(camera.near - near) < near * 0.01 &&
        Math.abs(camera.far - far) < far * 0.01
      ) {
        return;
      }

      camera.near = near;
      camera.far = far;
      camera.updateProjectionMatrix();
    };

    // LIGHTING CONFIGURATION FOR BETTER SHADOWS
    // 1. Ambient Light: Reduced intensity to make shadows darker
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));

    // 2. Directional Light: Main shadow caster
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(5, 10, 5); // Higher angle for better floor projection
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 20;
    directionalLight.shadow.camera.left = -5;
    directionalLight.shadow.camera.right = 5;
    directionalLight.shadow.camera.top = 5;
    directionalLight.shadow.camera.bottom = -5;
    scene.add(directionalLight);

    // --- SHADOW RECEIVING PLANE ---
    const planeGeo = new THREE.PlaneGeometry(40, 40);
    const planeMat = new THREE.ShadowMaterial({ opacity: 0.5 }); // Darker shadow on floor
    const shadowPlane = new THREE.Mesh(planeGeo, planeMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.z = -0.001; // Just below grid
    shadowPlane.receiveShadow = true;
    shadowPlane.name = 'shadow-plane';
    scene.add(shadowPlane);

    gridRef.current = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
    gridRef.current.rotation.x = Math.PI / 2;
    scene.add(gridRef.current);
    axesRef.current = new THREE.AxesHelper(1);
    scene.add(axesRef.current);

    // Measurement Group
    const measurementGroup = new THREE.Group();
    measurementGroup.name = 'measurement-group';
    scene.add(measurementGroup);
    measurementGroupRef.current = measurementGroup;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      updateCameraClipping();

      // Only push live matrix updates when the popup is actually visible,
      // and throttle to ~15Hz to avoid per-frame React state churn.
      if (selectedLinkRef.current && linkPopupVisibleRef.current) {
        const now = performance.now();
        if (now - lastMatrixPushRef.current >= MIN_MATRIX_PUSH_INTERVAL_MS) {
          lastMatrixPushRef.current = now;

          selectedLinkRef.current.updateWorldMatrix(true, false);

          let parentMatrix: THREE.Matrix4 | null = null;
          if (selectedLinkParentRef.current) {
            selectedLinkParentRef.current.updateWorldMatrix(true, false);
            parentMatrix = selectedLinkParentRef.current.matrixWorld.clone();
          }

          // Clone the matrix — Three.js reuses the instance, so a clone forces React updates.
          onSelectionUpdateRef.current(
            selectedLinkRef.current.name,
            selectedLinkRef.current.matrixWorld.clone(),
            parentMatrix,
          );
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);

      // Force immediate re-render to prevent flickering/black frames during resize
      if (sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    // Use ResizeObserver to detect container size changes (e.g. sidebar toggle)
    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(mountRef.current);

    // --- INTERACTION HANDLERS ---

    const getLinkFromEvent = (event: MouseEvent): URDFLink | null => {
      if (!mountRef.current || !camera || !robotRef.current) return null;
      // Standalone STL/STEP/PLY models have no links — skip the per-mousemove
      // raycast entirely (O(n) on multi-million-point clouds).
      if (!isURDFModelRef.current) return null;

      const rect = mountRef.current.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
      const intersects = raycaster.intersectObject(robotRef.current, true);

      // Search through ALL intersects to find the first valid Link
      for (const intersect of intersects) {
        let object: THREE.Object3D | null = intersect.object;

        // Skip helper objects
        if (isHelperObject(object)) continue;

        while (object) {
          if (isURDFLink(object)) return object;
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
      if (event.button !== 0) return;

      // If NOT in measurement mode, block Ctrl (keep legacy behavior for dragging)
      if (isCtrlPressedRef.current && !isMeasurementModeRef.current) return;

      if (!mountRef.current || !camera || !robotRef.current) return;

      // Standalone models have no selectable links/joints; only raycast them in
      // measurement mode so points can still be placed on the cloud.
      if (!isURDFModelRef.current && !isMeasurementModeRef.current) return;

      const rect = mountRef.current.getBoundingClientRect();
      const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      const intersects = raycaster.intersectObject(robotRef.current, true);

      // --- MEASUREMENT MODE ---
      if (isMeasurementModeRef.current) {
        // 1. Priority: Joint Centers (if clicking on a helper)
        // Useful when holding Ctrl to see joints
        const jointHit = intersects.find((i) => i.object.name === 'joint-helper');
        if (jointHit && jointHit.object.parent) {
          const joint = jointHit.object.parent;
          const centerPos = new THREE.Vector3().setFromMatrixPosition(joint.matrixWorld);
          onMeasurementClickRef.current(centerPos);
          return;
        }

        // 2. Standard: Mesh Surface
        const hit = intersects.find((i) => {
          let obj: THREE.Object3D | null = i.object;
          // Ignore helpers if we didn't catch them above
          while (obj) {
            if (isHelperObject(obj)) return false;
            obj = obj.parent;
          }
          return true;
        });

        if (hit) {
          onMeasurementClickRef.current(hit.point);
        }
        return; // Stop standard selection logic
      }

      // Find the link
      let link: URDFLink | null = null;
      let intersectPoint: THREE.Vector3 | null = null;

      for (const intersect of intersects) {
        let object: THREE.Object3D | null = intersect.object;
        if (isHelperObject(object)) continue;

        while (object) {
          if (isURDFLink(object)) {
            link = object;
            intersectPoint = intersect.point;
            break;
          }
          object = object.parent;
        }
        if (link) break;
      }

      if (link && intersectPoint && isURDFJoint(link.parent)) {
        const joint = link.parent;
        if (joint.jointType !== 'fixed') {
          const mesh = link.getObjectByProperty('isMesh', true) as THREE.Mesh;
          let originalMaterial: THREE.Material | THREE.Material[] | null = null;
          if (mesh) {
            originalMaterial = mesh.material;
            mesh.material = linkHighlightMaterialRef.current;
          }

          // Geometric Calculation for Drag
          const jointWorldPos = new THREE.Vector3().setFromMatrixPosition(joint.matrixWorld);
          const jointAxisWorld = new THREE.Vector3()
            .copy(joint.axis || new THREE.Vector3(0, 0, 1))
            .transformDirection(joint.matrixWorld)
            .normalize();

          let mode: 'rotational_plane' | 'projection' = 'projection';
          let plane: THREE.Plane | undefined;
          let startVector: THREE.Vector3 | undefined;

          // Determine best interaction mode
          if (joint.jointType === 'revolute' || joint.jointType === 'continuous') {
            // Check view angle relative to rotation axis
            const viewDir = new THREE.Vector3().subVectors(camera.position, jointWorldPos).normalize();
            const alignment = Math.abs(viewDir.dot(jointAxisWorld));

            if (alignment > 0.15) {
              mode = 'rotational_plane';
              plane = new THREE.Plane().setFromNormalAndCoplanarPoint(jointAxisWorld, jointWorldPos);

              // Find intersection on this ideal plane (better than mesh hit point)
              const planeIntersect = new THREE.Vector3();
              const hitPlane = raycaster.ray.intersectPlane(plane, planeIntersect);

              if (hitPlane) {
                startVector = new THREE.Vector3().subVectors(planeIntersect, jointWorldPos);
              } else {
                mode = 'projection';
              }
            }
          }

          dragInfoRef.current = {
            mode,
            joint: joint,
            startValue: (joint.angle as number) || 0,
            currentJointValue: (joint.angle as number) || 0, // Accumulator
            draggedMesh: mesh,
            originalMaterial: originalMaterial,

            // Projection data
            startMouseX: event.clientX,
            startMouseY: event.clientY,
            worldClickPoint: intersectPoint.clone(),

            // Planar data
            plane,
            jointAxis: jointAxisWorld,
            jointWorldPos,
            startVector,
            previousVector: startVector ? startVector.clone() : undefined, // Initialize previousVector
          };

          if (controlsRef.current) controlsRef.current.enabled = false;
        }
      }
    };

    const handleMouseMoveGlobal = (event: MouseEvent) => {
      if (!dragInfoRef.current || !camera || !rendererRef.current) return;
      const { mode, joint } = dragInfoRef.current; // Use mutable ref values

      let newValue = dragInfoRef.current.currentJointValue || 0;

      if (mode === 'rotational_plane') {
        const { plane, jointWorldPos, jointAxis, previousVector } = dragInfoRef.current;
        if (plane && jointWorldPos && jointAxis && previousVector) {
          const rect = rendererRef.current.domElement.getBoundingClientRect();
          const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

          raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
          const intersectPoint = new THREE.Vector3();
          const hitPlane = raycaster.ray.intersectPlane(plane, intersectPoint);

          if (hitPlane) {
            const currentVector = new THREE.Vector3().subVectors(intersectPoint, jointWorldPos);

            // Calculate incremental angle from Previous to Current
            // delta = atan2( cross(prev, curr).dot(axis), prev.dot(curr) )
            // |prev||curr| cancels out or scales both arguments of atan2 equally (magnitude doesn't affect atan2 angle)
            const cross = new THREE.Vector3().crossVectors(previousVector, currentVector);
            const y = cross.dot(jointAxis);
            const x = previousVector.dot(currentVector);

            const deltaAngle = Math.atan2(y, x);

            newValue = (dragInfoRef.current.currentJointValue || 0) + deltaAngle;

            // Update state for next frame
            dragInfoRef.current.currentJointValue = newValue;
            dragInfoRef.current.previousVector = currentVector;
          }
        }
      } else {
        // --- PROJECTION MODE (Legacy/Fallback/Prismatic) ---
        const { startMouseX, startMouseY, worldClickPoint, startValue } = dragInfoRef.current;
        if (startMouseX === undefined || startMouseY === undefined || !worldClickPoint) return;

        // 1. Get raw pixel movement
        const dx = event.clientX - startMouseX;
        const dy = event.clientY - startMouseY;
        const mouseMovePixels = new THREE.Vector2(dx, dy);

        // 2. Calculate motion vector direction
        const jointWorldPos = new THREE.Vector3().setFromMatrixPosition(joint.matrixWorld);
        const jointAxisWorld = new THREE.Vector3()
          .copy(joint.axis || new THREE.Vector3(0, 0, 1))
          .transformDirection(joint.matrixWorld);

        const moveDir3D = new THREE.Vector3();
        if (joint.jointType === 'revolute' || joint.jointType === 'continuous') {
          const relPoint = new THREE.Vector3().subVectors(worldClickPoint, jointWorldPos);
          moveDir3D.crossVectors(jointAxisWorld, relPoint);
        } else {
          moveDir3D.copy(jointAxisWorld);
        }

        // 3. Project to screen
        const p1 = worldClickPoint.clone().project(camera);
        const p2 = worldClickPoint.clone().add(moveDir3D).project(camera);

        const rect = rendererRef.current.domElement.getBoundingClientRect();
        const screenMotionVec = new THREE.Vector2(
          ((p2.x - p1.x) * rect.width) / 2,
          -((p2.y - p1.y) * rect.height) / 2,
        );

        const projectionLenSq = screenMotionVec.lengthSq();
        if (projectionLenSq > 0.0001) {
          const change = mouseMovePixels.dot(screenMotionVec) / projectionLenSq;
          newValue = startValue + change;
        }
      }

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
        const { draggedMesh, originalMaterial } = dragInfoRef.current;
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

      // --- MEASUREMENT MODE REMOVAL ---
      if (isMeasurementModeRef.current && measurementGroupRef.current) {
        const mIntersects = raycaster.intersectObject(measurementGroupRef.current, true);
        // Check if we hit a measurement sphere
        const sphereHit = mIntersects.find((i) => {
          const ud = i.object.userData as { isMeasurementPoint?: boolean };
          return ud.isMeasurementPoint === true;
        });
        if (sphereHit) {
          const index = (sphereHit.object.userData as { index?: number }).index;
          if (typeof index === 'number') {
            onMeasurementRemoveRef.current(index);
            return; // Stop other context menu logic
          }
        }
      }

      // Standalone models have no selectable links/joints — skip the robot raycast
      // (measurement-point removal above stays available for all models).
      if (!isURDFModelRef.current) return;

      // Raycast ONLY against the robot model to avoid hitting the grid/axes
      const intersects = raycaster.intersectObject(robotRef.current, true);

      // --- CTRL KEY LOGIC: Joint Selection ---
      if (isCtrlPressedRef.current) {
        if (intersects.length > 0) {
          // 1. Try to find if we hit a joint helper directly
          const helperIntersect = intersects.find((i) => i.object.name === 'joint-helper');
          if (helperIntersect && helperIntersect.object.parent) {
            const joint = helperIntersect.object.parent;
            if (isURDFJoint(joint) && joint.jointType !== 'fixed') {
              onJointSelectRef.current(joint);
              return;
            }
          }

          // 2. Fallback: If we hit a mesh, find the Link and then its parent Joint
          const link = findParentLink(intersects[0].object);
          if (link && isURDFJoint(link.parent)) {
            const joint = link.parent;
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
        const object: THREE.Object3D | null = intersect.object;

        // Skip helper objects
        if (isHelperObject(object)) continue;

        newSelection = findParentLink(object);
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
            const parentLink = findParentLink(newSelection.parent);
            selectedLinkParentRef.current = parentLink;

            let parentMatrix: THREE.Matrix4 | null = null;
            if (parentLink) {
              parentLink.updateWorldMatrix(true, false);
              parentMatrix = parentLink.matrixWorld.clone();
            }

            newSelection.updateWorldMatrix(true, false);
            onSelectionUpdateRef.current(
              newSelection.name,
              newSelection.matrixWorld.clone(),
              parentMatrix,
            );
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
      resizeObserver.disconnect();

      if (mountNode) {
        mountNode.removeEventListener('mousedown', handleMouseDown);
        mountNode.removeEventListener('mousemove', handleMouseMoveHover);
        mountNode.removeEventListener('contextmenu', handleContextMenu);

        // Remove the Ctrl-strip / right-click interceptors
        renderer.domElement.removeEventListener('pointerdown', stripCtrlKey, { capture: true });
        renderer.domElement.removeEventListener('pointermove', stripCtrlKey, { capture: true });
        renderer.domElement.removeEventListener('pointerup', stripCtrlKey, { capture: true });
        renderer.domElement.removeEventListener('mousedown', stripCtrlKey, { capture: true });
        renderer.domElement.removeEventListener('mousemove', stripCtrlKey, { capture: true });
        renderer.domElement.removeEventListener('mouseup', stripCtrlKey, { capture: true });
        renderer.domElement.removeEventListener('mousedown', stopBubble);
        renderer.domElement.removeEventListener('mousemove', stopBubble);
        renderer.domElement.removeEventListener('mouseup', stopBubble);
        renderer.domElement.removeEventListener('pointerdown', stopBubble);
        renderer.domElement.removeEventListener('pointermove', stopBubble);
        renderer.domElement.removeEventListener('pointerup', stopBubble);

        if (renderer.domElement.parentNode === mountNode) {
          mountNode.removeChild(renderer.domElement);
        }
      }
      window.removeEventListener('mousemove', handleMouseMoveGlobal);
      window.removeEventListener('mouseup', handleMouseUpGlobal);
      window.removeEventListener('blur', handleMouseUpGlobal);

      // Dispose measurement sprites/lines & highlight materials to free GPU memory
      if (measurementGroupRef.current) {
        disposeObject3D(measurementGroupRef.current);
        measurementGroupRef.current.clear();
      }
      linkHighlightMat.dispose();
      jointHighlightMat.dispose();

      // Dispose the static scene helpers + renderer
      planeGeo.dispose();
      planeMat.dispose();
      gridRef.current?.dispose();
      axesRef.current?.dispose();

      controls.dispose();
      renderer.dispose();
    };
  }, []);

  // 2. Robot Management — dispose GPU resources when a robot is swapped/unmounted
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    unhighlightLink();
    unhighlightJoint();
    onSelectionUpdateRef.current(null, null, null);

    if (robot) {
      scene.add(robot);
      if (autoFrame && cameraRef.current && controlsRef.current) {
        const bounds = new THREE.Box3().setFromObject(robot);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const largestDimension = Math.max(size.x, size.y, size.z);

        if (Number.isFinite(largestDimension) && largestDimension > 0) {
          const camera = cameraRef.current;
          const controls = controlsRef.current;
          const distance = largestDimension / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
          const direction = new THREE.Vector3(1, 1, 0.8).normalize();
          camera.position.copy(center).addScaledVector(direction, distance * 1.35);
          camera.near = Math.max(distance / 100, 0.001);
          camera.far = Math.max(distance * 100, 1000);
          camera.updateProjectionMatrix();
          controls.target.copy(center);
          controls.update();
        }
      }
      return () => {
        scene.remove(robot);
        disposeObject3D(robot);
      };
    }
  }, [robot, autoFrame]);

  // 2b. Point-cloud point size — apply the multiplier on top of the loader's auto size.
  useEffect(() => {
    if (!robot) return;
    robot.traverse((obj) => {
      if (obj instanceof THREE.Points) {
        (obj.material as THREE.PointsMaterial).size =
          (obj.userData.basePointSize as number) * pointSize;
      }
    });
  }, [robot, pointSize]);

  // 2c. Point-cloud density — subsample the geometry or restore the full cloud.
  useEffect(() => {
    if (!robot) return;
    robot.traverse((obj) => {
      if (obj instanceof THREE.Points) applyPointDensity(obj, pointDensity);
    });
  }, [robot, pointDensity]);

  // 3. Display Toggles
  useEffect(() => {
    const effectiveShowJointAxes = showJointAxes || isCtrlPressed;

    const scene = sceneRef.current;
    if (scene) {
      const shadowPlane = scene.getObjectByName('shadow-plane');
      if (shadowPlane) shadowPlane.visible = showShadows;

      scene.traverse((obj) => {
        if (obj instanceof THREE.DirectionalLight) {
          obj.castShadow = showShadows;
        }
      });
    }

    if (robot) {
      // Wireframe & Shadows
      robot.traverse((c) => {
        const mesh = c.getObjectByProperty('isMesh', true) as THREE.Mesh;
        if (mesh) {
          mesh.castShadow = showShadows;
          mesh.receiveShadow = showShadows;

          if (
            mesh.material !== linkHighlightMaterialRef.current &&
            mesh.material !== jointHighlightMaterialRef.current
          ) {
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            materials.forEach((m) => {
              (m as THREE.MeshStandardMaterial).wireframe = wireframe;
            });
          }
        }
      });
      // Link Axes
      robot.traverse((c) => {
        if (isURDFLink(c)) {
          let axes = c.children.find((child) => child.name === 'axes-helper-link');
          if (showLinkAxes && !axes) {
            axes = new THREE.AxesHelper(0.2); // Larger for links
            axes.name = 'axes-helper-link';
            c.add(axes);
          }
          if (axes) axes.visible = showLinkAxes;
        }
      });

      // Joint Visuals (Custom Shapes)
      robot.traverse((c) => {
        if (isURDFJoint(c)) {
          const joint = c;
          let helper = joint.children.find((child) => child.name === 'joint-helper');

          if (effectiveShowJointAxes && !helper) {
            const material = new THREE.MeshBasicMaterial({
              color: 0xffaa00,
              transparent: true,
              opacity: 0.8,
              depthTest: false, // Make it visible through parts
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
  }, [robot, wireframe, showLinkAxes, showJointAxes, showShadows, isCtrlPressed]);

  useEffect(() => {
    if (gridRef.current) gridRef.current.visible = showGrid;
    if (axesRef.current) axesRef.current.visible = showWorldAxes;
  }, [showGrid, showWorldAxes]);

  // 4. Measurement Visualization
  useEffect(() => {
    const group = measurementGroupRef.current;
    if (!group) return;

    // Clear previous (dispose geometry/materials + textures to avoid leaks)
    while (group.children.length > 0) {
      const child = group.children[0];
      disposeObject3D(child);
      group.remove(child);
    }

    if (measurementPoints.length === 0) return;

    // Helper to create text sprite
    const createLabelSprite = (text: string) => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return null;

      const fontSize = 24; // Smaller high-res font
      context.font = `bold ${fontSize}px Arial`;
      const textMetrics = context.measureText(text);

      // Add minimal padding for shadow
      canvas.width = textMetrics.width + 10;
      canvas.height = fontSize + 10;

      // Re-setup context
      context.font = `bold ${fontSize}px Arial`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';

      // Text Shadow for readability without box
      context.shadowColor = 'rgba(0, 0, 0, 1.0)';
      context.shadowBlur = 4;
      context.shadowOffsetX = 1;
      context.shadowOffsetY = 1;

      // Text
      context.fillStyle = '#ffffff';
      context.fillText(text, canvas.width / 2, canvas.height / 2);

      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;

      const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        depthTest: false,
        transparent: true,
      });
      const sprite = new THREE.Sprite(spriteMaterial);

      // Scale down to world units
      const scaleFactor = 0.002;
      sprite.scale.set(canvas.width * scaleFactor, canvas.height * scaleFactor, 1);

      return sprite;
    };

    // Materials
    const pointMat = new THREE.MeshBasicMaterial({
      color: 0xff5722,
      depthTest: false,
      transparent: true,
      opacity: 0.9,
    });
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xff5722,
      depthTest: false,
      transparent: true,
      opacity: 0.8,
      linewidth: 2,
    });

    // Render Points
    measurementPoints.forEach((pt, i) => {
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.015, 16, 16), pointMat);
      sphere.position.copy(pt);
      sphere.renderOrder = 999;
      sphere.userData = { isMeasurementPoint: true, index: i };
      group.add(sphere);
    });

    // Render Lines and Labels
    if (measurementPoints.length > 1) {
      const geometry = new THREE.BufferGeometry().setFromPoints(measurementPoints);
      const line = new THREE.Line(geometry, lineMat);
      line.renderOrder = 998;
      group.add(line);

      // Labels for each segment
      for (let i = 0; i < measurementPoints.length - 1; i++) {
        const p1 = measurementPoints[i];
        const p2 = measurementPoints[i + 1];
        const dist = p1.distanceTo(p2);

        const label = createLabelSprite(`${dist.toFixed(4)}m`);
        if (label) {
          const midPoint = new THREE.Vector3().lerpVectors(p1, p2, 0.5);
          label.position.copy(midPoint);
          // Offset slightly up so it doesn't clip line perfectly
          label.position.z += 0.05;
          label.renderOrder = 1000;
          group.add(label);
        }
      }
    }
  }, [measurementPoints]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
};

export default Viewer;
