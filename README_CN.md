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


一个基于 Web 的专业 **URDF** 与 **Xacro** 机器人模型可视化工具，同时支持独立的 CAD 文件（STL/STEP）和 **PLY 点云**。基于现代 Web 技术栈构建，可完全在浏览器端解析并渲染复杂的机器人描述文件，无需本地 ROS 环境。

**在线演示:** [https://unlinearity.github.io/URDF-Visualizer/](https://unlinearity.github.io/URDF-Visualizer/)

> **English**: Please read [README.md](README.md)

---

## 项目概述

本项目解决了在浏览器环境中可视化 ROS 机器人模型的挑战。它实现了一个自定义的文件系统抽象层来处理 `package://` 路径，并完全使用 JavaScript 执行递归的 Xacro 宏展开。

---

## 一、核心特性

### 1.1 高保真渲染
- **渲染引擎**：基于 [Three.js](https://threejs.org/)，支持 PBR 材质、动态光照和阴影。
- **视觉辅助**：集成网格系统、坐标轴（世界/局部）和关节可视化辅助工具。

### 1.2 全面的文件支持
- **拖拽工作流**：支持将包含 URDF、网格模型（STL/DAE/OBJ）和纹理的完整目录拖入浏览器。
- **独立 CAD 查看器**：直接打开 `.stl`、`.step`、`.stp` 文件。STEP 文件通过 WebAssembly 在浏览器本地完成网格化，模型数据不会上传。
- **PLY 点云**：支持将 `.ply` 文件渲染为带顶点颜色的点云，解析在 Web Worker 中进行，百万级点云也不会冻结界面。点大小自适应，并提供「点大小」与「点密度」调节滑块（后者可对超大点云抽稀，平衡内存与帧率）；含面的 PLY 文件渲染为普通网格。
- **路径解析**：将 ROS 风格的 `package://` 路径映射到上传的文件夹结构，实现自动资源解析。

### 1.3 高级 Xacro 引擎
- **客户端编译**：直接在浏览器中解析 `.xacro` 文件。
- **递归包含**：处理嵌套的 `<xacro:include>` 标签并解析依赖关系。
- **ROS 命令模拟**：利用虚拟文件上下文模拟 `$(find pkg_name)` 命令。

### 1.4 交互式审查
- **运动学结构树**：展示连杆与关节层级结构的可视化图表。
- **关节操控**：交互式滑块控制关节角度并强制限位；按 **A** 键可播放关节自动演示动画。
- **矩阵审查**：实时查看任意选中部件的世界/局部变换矩阵和欧拉角（RPY）。

---

## 二、使用指南

### 2.1 加载模型

<p align='center'><img src='src\picture\import.gif' width=95%></p> 

1.  **样本库**：从下拉菜单中选择预配置的机器人（如 Unitree Go2、Fourier G1）或点云示例。
2.  **独立 CAD 文件**：点击 **View STL / STEP / STP / PLY**，或将 `.stl`、`.step`、`.stp`、`.ply` 文件拖入查看器。加载后相机自动取景，网格与世界坐标轴保持可用。PLY 文件渲染为带色点云（点大小自适应，可通过「Point Size」与「Point Density」滑块调节），含面的 PLY 文件渲染为普通网格。
3.  **本地文件夹上传**：
    - 点击 **Select Project Folder** 上传包含机器人描述（URDF 与 Meshes）的根目录。
    - **推荐结构**：文件夹结构应尽量符合标准 ROS 功能包布局。
    - **支持多种导入格式**：
      - 单个 `.urdf` 或 `.xacro` 文件；
      - 包含 `.urdf` 与 `.dae` / `.stl` 等模型文件的目录，用于引入复杂几何与纹理；
      - 由多个 `.xacro` 配置文件组成、以 `main.xacro` 作为入口的工程目录。

### 2.2 操作控制

<p align='center'><img src='src\picture\note.gif' width=95%></p>

| 操作 | 鼠标 | 说明 |
| :--- | :--- | :--- |
| **旋转** | 左键拖拽 | 围绕焦点旋转相机。 |
| **平移** | 右键拖拽 | 横向移动相机。 |
| **缩放** | 滚轮 | 放大或缩小。 |
| **选择** | 左键单击 | 选中连杆以查看其属性。 |
| **关节** | **Ctrl** + 右键 | 选中关节以查看轴向和控制旋钮。 |

- **W**：显示/隐藏世界坐标系
- **G**：显示/隐藏地面网格
- **L**：显示/隐藏连杆局部坐标系
- **J**：显示/隐藏关节轴指示器
- **F**：切换线框渲染模式
- **T**：显示/隐藏运动学结构树
- **R**：开启/关闭测量模式
- **A**：开始/暂停关节自动演示动画

### 2.3 运动学结构树

<p align='center'><img src='src\picture\tree.gif' width=95%></p>

- **概述**：一个基于 SVG 的全屏覆盖层，直观展示机器人的连杆与关节层级结构。
- **开关**：点击右上角工具条中的结构树图标，或按 **T** 键。
- **双向交互**：
  - **树 → 3D**：点击树中任意节点，即可在 3D 视图中高亮对应部件。
  - **3D → 树**：在 3D 场景中选择部件（右键或 Ctrl+右键），结构树自动展开并高亮对应节点。
- **图例**：
  - **圆圈（○）**：代表**关节**。
  - **方框（□）**：代表**连杆**。
- **节点详情**：选中节点后，侧边面板会显示关节类型、限位及轴向等详细属性。

### 2.4 测量工具

<p align='center'><img src='src\picture\measure.gif' width=95%></p>

- **激活**：点击右上角工具条中的直尺图标，或按 **R** 键。
- **测量**：点击机器人模型表面添加测量点，相邻点之间显示连线及距离。
- **关节吸附**：按住 **Ctrl** 显示关节（橙色指示器），点击关节即可将测量点吸附至其中心。
- **动态更新**：测量点附着在指定的连杆或关节上，并随机器人运动而移动。
- **移除点**：右键点击测量点（红色球体）即可删除。



> **注意**：已屏蔽 `Ctrl + R`（浏览器刷新）快捷键，防止误操作丢失已加载的模型。


---

## 三、开发指南

### 3.1 环境要求
- [Node.js](https://nodejs.org/)（18 或更高版本，推荐 20+）
- [npm](https://www.npmjs.com/)（Node 包管理器）

### 3.2 安装步骤

克隆仓库并安装依赖：

```bash
git clone https://github.com/UNLINEARITY/URDF-Visualizer.git
cd URDF-Visualizer
npm install
```

### 3.3 本地开发

启动带有热重载（HMR）的开发服务器：

```bash
npm run dev
```

访问地址：[http://localhost:5173](http://localhost:5173)。

### 3.4 部署

本项目使用 **Vite** 构建、**gh-pages** 部署。

1.  **构建**：编译 TypeScript 并将资源打包至 `dist` 目录。
2.  **发布**：将 `dist` 目录推送到 `gh-pages` 分支。

```bash
npm run deploy
```

---

## 四、技术栈

本项目使用了以下开源技术：

- **核心框架**：[React](https://reactjs.org/) (v18) —— 组件化 UI 库。
- **3D 引擎**：[Three.js](https://threejs.org/) —— WebGL 渲染引擎；使用其内置的 `PLYLoader` 渲染点云。
- **构建工具**：[Vite](https://vitejs.dev/) —— 快速前端构建工具。
- **URDF 解析**：[urdf-loader](https://github.com/gkjohnson/urdf-loader) —— 面向 Three.js 的 URDF 加载器。
- **Xacro 解析**：[xacro-parser](https://github.com/gkjohnson/xacro-parser) —— 基于 JavaScript 的 Xacro 解析器。
- **STEP 解析**：[occt-import-js](https://github.com/kovacsv/occt-import-js) —— OpenCascade WASM，仅在打开 STEP/STP 时按需加载。

---

## 五、许可协议

本项目基于 MIT 许可证开源。详情请参阅 LICENSE 文件。
