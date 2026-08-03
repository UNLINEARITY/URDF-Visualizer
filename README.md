# URDF Visualizer

<p align='center'><img src='src\picture\all.png' width=95%></p> 

  <div  align="center" >
    <a href="https://github.com/UNLINEARITY/URDF-Visualizer/stargazers">
      <img src="https://img.shields.io/github/stars/UNLINEARITY/URDF-Visualizer.svg" alt="Stars">
    </a>
    <a href="https://github.com/UNLINEARITY/URDF-Visualizer/network/members">
      <img src="https://img.shields.io/github/forks/UNLINEARITY/URDF-Visualizer.svg" alt="Forks">
    </a>
    <a href="https://github.com/UNLINEARITY/URDF-Visualizer/issues">
      <img src="https://img.shields.io/github/issues/UNLINEARITY/URDF-Visualizer.svg" alt="Issues">
    </a> <a href="https://github.com/UNLINEARITY/URDF-Visualizer/pulls">
      <img src="https://img.shields.io/github/issues-pr/UNLINEARITY/URDF-Visualizer.svg" alt="Pull Requests">
    </a>
 </div>


A professional, web-based visualization tool for **URDF** (Unified Robot Description Format) and **Xacro** robot models, plus standalone CAD files (STL/STEP) and **PLY point clouds**. Built on the modern web stack, it parses and renders complex robot descriptions entirely in the browser — no local ROS environment required.

**Live Demo:** [https://unlinearity.github.io/URDF-Visualizer/](https://unlinearity.github.io/URDF-Visualizer/)

> **简体中文**：请阅读 [README_CN.md](README_CN.md)

---

## Overview

This project solves the challenge of visualizing ROS robot models in a browser environment. It implements a custom file-system abstraction to resolve `package://` paths and performs recursive Xacro macro expansion purely in JavaScript.

---

## 1. Key Features

### 1.1 High-Fidelity Rendering
- **Engine**: Powered by [Three.js](https://threejs.org/), with support for PBR materials, dynamic lighting, and shadows.
- **Visual Helpers**: Integrated grid systems, coordinate axes (world/local), and joint visualization helpers.

### 1.2 Comprehensive File Support
- **Drag & Drop Workflow**: Drag entire directories containing URDFs, meshes (STL/DAE/OBJ), and textures into the browser.
- **Standalone CAD Viewer**: Open `.stl`, `.step`, and `.stp` files directly. STEP files are tessellated locally in the browser via WebAssembly, so model data never leaves your machine.
- **PLY Point Clouds**: Open `.ply` files as colored point clouds, parsed on a Web Worker so multi-million-point files never freeze the UI. Auto-sized points plus adjustable point-size and point-density sliders (the latter subsamples huge clouds to balance memory and frame rate); PLY files with faces render as regular meshes.
- **Path Resolution**: Automatically resolves ROS-style `package://` paths by mapping them to the uploaded folder structure.

### 1.3 Advanced Xacro Engine
- **Client-Side Compilation**: Parses `.xacro` files directly in the browser.
- **Recursive Includes**: Handles nested `<xacro:include>` tags and resolves dependencies.
- **ROS Command Simulation**: Simulates `$(find pkg_name)` commands using the virtual file context.

### 1.4 Interactive Inspection
- **Kinematic Tree**: A visual graph displaying the hierarchical structure of links and joints.
- **Joint Manipulation**: Interactive sliders control joint angles with limit enforcement; the auto-demo animation (key **A**) sweeps every joint through its range.
- **Matrix Inspection**: Real-time view of world/local transformation matrices and Euler angles (RPY) for any selected part.

---

## 2. User Guide

### 2.1 Loading Models

<p align='center'><img src='src\picture\import.gif' width=95%></p> 

1.  **Sample Library**: Select a pre-configured robot (e.g., Unitree Go2, Fourier G1) or a point-cloud sample from the dropdown menu.
2.  **Standalone CAD File**: Click **View STL / STEP / STP / PLY** or drop one `.stl`, `.step`, `.stp`, or `.ply` file onto the viewer. The camera frames the model automatically, and the grid and world axes remain available. PLY files render as colored point clouds (auto-sized, adjustable via the Point Size and Point Density sliders) or as meshes when they contain faces.
3.  **Local Folder Upload**:
    - Click **Select Project Folder** to upload a root folder containing your robot description (URDFs and meshes).
    - **Recommended Structure**: Ensure the folder mirrors a standard ROS package layout.
    - **Supports multiple import formats**:
      - A single `.urdf` or `.xacro` file;
      - A directory containing a `.urdf` file along with `.dae` / `.stl` model files, enabling complex geometry and textures;
      - A project directory composed of multiple `.xacro` configuration files, with `main.xacro` serving as the entry point.

### 2.2 Controls

<p align='center'><img src='src\picture\note.gif' width=95%></p>

| Action | Mouse | Description |
| :--- | :--- | :--- |
| **Rotate** | Left Click + Drag | Rotate the camera around the focus point. |
| **Pan** | Right Click + Drag | Move the camera laterally. |
| **Zoom** | Scroll Wheel | Zoom in or out. |
| **Select** | Left Click | Select a link to inspect its properties. |
| **Joint** | **Ctrl** + Right Click | Select a joint to view its axis and control knob. |

- **W**: Toggle world axes
- **G**: Toggle ground grid
- **L**: Toggle link local coordinate axes
- **J**: Toggle joint axis indicators
- **F**: Toggle wireframe mode
- **T**: Toggle kinematic structure tree
- **R**: Toggle measurement mode
- **A**: Start / pause the joint auto-demo animation

### 2.3 Kinematic Structure Tree

<p align='center'><img src='src\picture\tree.gif' width=95%></p>

- **Overview**: A full-screen SVG-based overlay that visualizes the robot's link and joint hierarchy.
- **Toggle**: Click the tree icon in the top-right toolbar, or press **T**.
- **Bidirectional Interaction**:
  - **Tree to 3D**: Click any node in the tree to highlight the corresponding part in the 3D viewer.
  - **3D to Tree**: Selecting a part in the 3D scene (Right Click or Ctrl+Right Click) automatically expands and highlights the node in the tree.
- **Legend**:
  - **Circles (○)**: Represent **joints**.
  - **Rectangles (□)**: Represent **links**.
- **Node Details**: Selecting a node displays detailed properties such as joint types, limits, and axis information in a side panel.

### 2.4 Measurement Tool

<p align='center'><img src='src\picture\measure.gif' width=95%></p>

- **Activate**: Click the ruler icon in the top-right toolbar, or press **R**.
- **Measure**: Click on the robot model to add measurement points. A line with distance labels appears between sequential points.
- **Joint Snapping**: Hold **Ctrl** to reveal joints (orange indicators), then click a joint to snap the measurement point to its exact center.
- **Dynamic Updates**: Measurement points attach to the specific link or joint and move with the robot as you manipulate it.
- **Remove Point**: Right-click a measurement point (red sphere) to remove it.



> **Note**: `Ctrl + R` (browser refresh) is blocked to prevent accidentally losing loaded models.


---

## 3. Development

### 3.1 Prerequisites
- [Node.js](https://nodejs.org/) (Version 18 or higher; Node 20+ recommended)
- [npm](https://www.npmjs.com/) (Node Package Manager)

### 3.2 Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/UNLINEARITY/URDF-Visualizer.git
cd URDF-Visualizer
npm install
```

### 3.3 Local Development

Start the development server with Hot Module Replacement (HMR):

```bash
npm run dev
```

Access the application at [http://localhost:5173](http://localhost:5173).

### 3.4 Deployment

This project uses **Vite** for building and **gh-pages** for deployment.

1.  **Build**: Compiles TypeScript and bundles assets to the `dist` directory.
2.  **Deploy**: Pushes the `dist` directory to the `gh-pages` branch.

```bash
npm run deploy
```

---

## 4. Technology Stack

This project leverages the following open-source technologies:

- **Core Framework**: [React](https://reactjs.org/) (v18) - component-based UI library.
- **3D Engine**: [Three.js](https://threejs.org/) - WebGL rendering engine; its built-in `PLYLoader` renders point clouds.
- **Build Tool**: [Vite](https://vitejs.dev/) - fast frontend build tool.
- **URDF Parsing**: [urdf-loader](https://github.com/gkjohnson/urdf-loader) - comprehensive URDF loader for Three.js.
- **Xacro Parsing**: [xacro-parser](https://github.com/gkjohnson/xacro-parser) - JavaScript-based Xacro parser.
- **STEP Parsing**: [occt-import-js](https://github.com/kovacsv/occt-import-js) - OpenCascade WASM, lazy-loaded only when a STEP/STP file is opened.

---

## 5. License

This project is available under the MIT License. See the LICENSE file for more details.
