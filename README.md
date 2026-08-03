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


A professional, web-based visualization tool for **URDF** (Unified Robot Description Format) and **Xacro** robot models. Built on the modern web stack, this application allows for client-side parsing and rendering of complex robot descriptions without requiring a local ROS environment.

一个基于 Web 的专业 **URDF** 和 **Xacro** 机器人模型可视化工具。基于现代 Web 技术栈构建，允许在无需本地 ROS 环境的情况下，在客户端直接解析并渲染复杂的机器人描述文件。

**Live Demo / 在线演示:** [https://unlinearity.github.io/URDF-Visualizer/](https://unlinearity.github.io/URDF-Visualizer/)

---

## Overview / 项目概述

This project solves the challenge of visualizing ROS robot models in a browser environment. It implements a custom file system abstraction to handle `package://` paths and performs recursive Xacro macro expansion purely in JavaScript.

本项目解决了在浏览器环境中可视化 ROS 机器人模型的挑战。它实现了一个自定义的文件系统抽象层来处理 `package://` 路径，并完全使用 JavaScript 执行递归的 Xacro 宏展开。

---

## 1. Key Features / 核心特性

### 1.1 High-Fidelity Rendering / 高保真渲染
- **Engine**: Powered by [Three.js](https://threejs.org/), supporting PBR materials, dynamic lighting, and shadows.
  **引擎**: 基于 Three.js，支持 PBR 材质、动态光照和阴影。
- **Visual Helpers**: Integrated grid systems, coordinate axes (World/Local), and joint visualization helpers.
  **视觉辅助**: 集成网格系统、坐标轴（世界/局部）和关节可视化辅助工具。

### 1.2 Comprehensive File Support / 全面的文件支持
- **Drag & Drop Workflow**: Support for dragging entire directories containing URDFs, meshes (STL/DAE/OBJ), and textures.
  **拖拽工作流**: 支持拖拽包含 URDF、网格模型 (STL/DAE/OBJ) 和纹理的完整目录。
- **Standalone CAD Viewer**: Open `.stl`, `.step`, and `.stp` files directly. STEP files are tessellated locally in the browser, so model data is never uploaded.
- **Path Resolution**: Automatically resolves ROS-style `package://` paths by mapping them to the uploaded folder structure.
  **路径解析**: 通过将 ROS 风格的 `package://` 路径映射到上传的文件夹结构，实现自动资源解析。

### 1.3 Advanced Xacro Engine / 高级 Xacro 引擎
- **Client-Side Compilation**: Parses `.xacro` files directly in the browser.
  **客户端编译**: 直接在浏览器中解析 `.xacro` 文件。
- **Recursive Includes**: Handles nested `<xacro:include>` tags and resolves dependencies.
  **递归包含**: 处理嵌套的 `<xacro:include>` 标签并解析依赖关系。
- **ROS Command Simulation**: Simulates `$(find pkg_name)` commands using the virtual file context.
  **ROS 命令模拟**: 利用虚拟文件上下文模拟 `$(find pkg_name)` 命令。

### 1.4 Interactive Inspection / 交互式审查
- **Kinematic Tree**: A visual graph displaying the hierarchical structure of Links and Joints.
  **运动学树**: 展示连杆和关节层级结构的各类可视化图表。
- **Joint Manipulation**: Interactive sliders to control joint angles with limit enforcement.
  **关节操控**: 带有限位强制功能的交互式关节角度控制滑块。
- **Matrix Inspection**: Real-time view of World/Local transformation matrices and Euler angles (RPY) for any selected part.
  **矩阵审查**: 实时查看任意选中部件的世界/局部变换矩阵和欧拉角 (RPY)。

---

## 2. User Guide / 使用指南

### 2.1 Loading Models / 加载模型

<p align='center'><img src='src\picture\import.gif' width=95%></p> 

1.  **Sample Library**: Select a pre-configured robot (e.g., Unitree Go2, Fourier G1) from the dropdown menu.
    **样本库**: 从下拉菜单中选择预配置的机器人（如 Unitree Go2, G1）。
2.  **Standalone CAD File**: Click **View STL / STEP / STP / PLY** or drop one `.stl`, `.step`, `.stp`, or `.ply` file onto the viewer. The camera frames the model automatically; grid, shadow, wireframe, and measurement tools remain available. PLY files render as colored point clouds (auto-sized, adjustable via the Point Size slider) or as meshes when they contain faces.
3.  **Local Folder Upload**:
    **本地文件夹上传**:
    - Click **Select Project Folder** to upload a root folder containing your robot description (URDFs and Meshes).
      点击 **Select Project Folder** 上传包含机器人描述（URDF 和 Meshes）的根目录。
    - **Recommended Structure**: Ensure the folder mirrors a standard ROS package layout.
      **推荐结构**: 确保文件夹结构符合标准 ROS 功能包布局。
    - **Supports multiple import formats**:
      - A single `.urdf` or `.xacro` file;
      - A directory containing a `.urdf` file along with `.dae` / `.stl` model files, enabling complex geometry and textures;
      - A project directory composed of multiple `.xacro` configuration files, with `main.xacro` serving as the entry point.

    - 支持多种文件的导入 
      - 单个 .urdf 或 .xacro 文件；
      - 包含 .urdf 与 .dae / .stl 等模型文件的文件夹，用于引入复杂几何与纹理；
      - 由多个 .xacro 配置文件组成、以 main.xacro 作为入口的工程目录。 

  
### 2.2 Controls / 操作控制

<p align='center'><img src='src\picture\note.gif' width=95%></p>

| Action / 动作 | Mouse / Mouse | Description / 说明 |
| :--- | :--- | :--- |
| **Rotate** / 旋转 | Left Click + Drag | Rotate the camera around the focus point. / 围绕焦点旋转相机。 |
| **Pan** / 平移 | Right Click + Drag | Move the camera laterally. / 横向移动相机。 |
| **Zoom** / 缩放 | Scroll Wheel | Zoom in or out. / 放大或缩小。 |
| **Select** / 选择 | Left Click | Select a Link to inspect its properties. / 选择连杆以查看属性。 |
| **Joint** / 关节 | **Ctrl** + Right Click | Select a Joint to view axis and control knob. / 选择关节以查看轴向和控制旋钮。 |


- **W**: Toggle World Axes / 显示或隐藏世界坐标系
- **G**: Toggle Grid / 显示或隐藏地面网格
- **L**: Toggle Link Axes / 显示或隐藏连杆局部坐标系
- **J**: Toggle Joint Axes / 显示或隐藏关节轴指示器
- **F**: Toggle Wireframe Mode / 切换线框渲染模式
- **T**: Toggle Kinematic Tree / 显示或隐藏运动学结构树
- **R**: Toggle Measurement Mode / 开启或关闭测量模式 


### 2.3 Kinematic Structure Tree / 运动学结构树

<p align='center'><img src='src\picture\tree.gif' width=95%></p>

- **Overview**: A full-screen SVG-based overlay that visualizes the robot's link and joint hierarchy.
  **概述**: 一个基于 SVG 的全屏覆盖层，直观展示机器人的连杆与关节层级结构。
- **Toggle**: Click the tree icon (🌳) or press **T**.
  **开关**: 点击树状图标 (🌳) 或按 **T** 键。
- **Bidirectional Interaction**:
  **双向交互**:
  - **Tree to 3D**: Click any node in the tree to highlight the corresponding part in the 3D viewer.
    **树转3D**: 点击树中的任意节点，即可在 3D 视图中高亮对应的部件。
  - **3D to Tree**: Selecting a part in the 3D scene (Right Click or Ctrl+Right Click) will automatically expand and highlight the node in the tree.
    **3D转树**: 在 3D 场景中选择部件（右键或 Ctrl+右键），树状图将自动展开并高亮对应节点。
- **Legend / 图例**:
  - **Circles (○)**: Represent **Joints**.
    **圆圈 (○)**: 代表 **关节 (Joints)**。
  - **Rectangles (□)**: Represent **Links**.
    **方框 (□)**: 代表 **连杆 (Links)**。
- **Node Details**: Selecting a node displays detailed properties such as joint types, limits, and axis information in a side panel.
  **节点详情**: 选择节点后，侧边面板会显示关节类型、限位及轴向等详细属性。



### 2.4 Measurement Tool / 测量工具

<p align='center'><img src='src\picture\measure.gif' width=95%></p>

- **Activate**: Click the ruler icon (📏) or press **R**.
  **激活**: 点击直尺图标 (📏) 或按 **R** 键。
- **Measure**: Click on the robot model to add measurement points. A line with distance labels will appear between sequential points.
  **测量**: 点击机器人模型表面添加测量点。点与点之间将显示连线及距离。
- **Joint Snapping**: Hold **Ctrl** to reveal joints (orange indicators), then click a joint to snap the measurement point to its exact center.
  **关节吸附**: 按住 **Ctrl** 显示关节（橙色指示器），点击关节即可将测量点吸附至其中心。
- **Dynamic Updates**: Measurement points are attached to the specific link or joint and will move with the robot as you manipulate it.
  **动态更新**: 测量点会附着在特定的连杆或关节上，并随机器人运动而移动。
- **Remove Point**: Right-click on a measurement point (red sphere) to remove it.
  **移除点**: 右键点击测量点（红色球体）即可将其移除。



> **Note**: `Ctrl + R` (Browser Refresh) is blocked to prevent accidental loss of loaded models.
> **注意**: 已屏蔽 `Ctrl + R` (浏览器刷新) 快捷键，防止意外丢失已加载的模型。


---

## 3. Development / 开发指南

### 3.1 Prerequisites / 环境要求
- [Node.js](https://nodejs.org/) (Version 16 or higher)
- [npm](https://www.npmjs.com/) (Node Package Manager)

### 3.2 Installation / 安装步骤

Clone the repository and install dependencies:
克隆仓库并安装依赖：

```bash
git clone https://github.com/UNLINEARITY/URDF-Visualizer.git
cd URDF-Visualizer
npm install
```

### 3.3 Local Development / 本地开发

Start the development server with Hot Module Replacement (HMR):
启动带有热重载功能的开发服务器：


```bash
npm run dev
```

Access the application at [http://localhost:5173](http://localhost:5173).
访问地址：[http://localhost:5173](http://localhost:5173)。

### 3.4 Deployment / 部署

This project uses **Vite** for building and **gh-pages** for deployment.
本项目使用 **Vite** 进行构建，使用 **gh-pages** 进行部署。

1.  **Build**: Compiles TypeScript and bundles assets to the `dist` directory.
    **构建**: 编译 TypeScript 并将资源打包至 `dist` 目录。
2.  **Deploy**: Pushes the `dist` directory to the `gh-pages` branch.
    **发布**: 将 `dist` 目录推送到 `gh-pages` 分支。

```bash
npm run deploy
```

---

## 4. Technology Stack / 技术栈

This project leverages the following open-source technologies:
本项目使用了以下开源技术：

- **Core Framework**: [React](https://reactjs.org/) (v18) - Component-based UI library.
- **3D Engine**: [Three.js](https://threejs.org/) - WebGL rendering engine.
- **Build Tool**: [Vite](https://vitejs.dev/) - Fast frontend build tool.
- **URDF Parsing**: [urdf-loader](https://github.com/gkjohnson/urdf-loader) - Comprehensive URDF loader for Three.js.
- **Xacro Parsing**: [xacro-parser](https://github.com/gkjohnson/xacro-parser) - JavaScript-based Xacro parser.

---

## 5. License / 许可协议

This project is available under the MIT License. See the LICENSE file for more details.
本项目基于 MIT 许可证开源。详情请参阅 LICENSE 文件。
