# URDF Visualizer (Web-based) 项目技术文档

## 1. 项目概述

**URDF Visualizer** 是一个基于 Web 技术的跨平台机器人模型可视化与分析工具。它旨在脱离复杂的 ROS 环境，仅通过现代浏览器即可实现 URDF (Unified Robot Description Format) 模型的加载、渲染、交互控制及运动学数据的实时分析。

本项目采用 **前后端分离** 架构（但通过并发工具整合运行），前端负责核心渲染与交互，后端负责文件资源管理。

---

## 2. 技术栈 (Tech Stack)

### 前端 (Frontend)
*   **框架**: React 18 + TypeScript (提供组件化与类型安全)
*   **构建工具**: Vite (极速开发体验，配置了 API 代理)
*   **3D 引擎**: Three.js (WebGL 渲染库)
*   **模型加载**: `urdf-loader` (解析 URDF XML 并生成 Three.js 对象图)
*   **数学库**: Three.js Math (Matrix4, Quaternion, Vector3, Euler)
*   **UI 交互**: HTML5/CSS3 (自定义深色主题 UI)

### 后端 (Backend)
*   **运行环境**: Node.js
*   **框架**: Express.js (轻量级 Web 服务器)
*   **功能**: 静态资源服务、文件系统遍历 (API `/api/samples`)、**Xacro 预拼装引擎**（处理递归包含与路径解析）。
*   **环境模拟**: `jsdom` (在 Node.js 中完整模拟 DOM 环境以支持服务端解析)。

### 工具链 (Tooling)
*   **运行管理**: `concurrently` (单命令同时启动前后端)
*   **包管理**: npm

---

## 3. 系统架构与模块设计

项目采用组件化设计，数据流单向流动，但在高性能渲染环节（3D 循环）采用了 Ref 机制以规避 React 闭包陷阱。

### 3.1 目录结构
```text
URDF/
├── public/                 # 存放示例 URDF 模型文件
├── server/                 # 后端服务器代码
│   └── index.js            # Express API 入口
├── src/                    # 前端源代码
│   ├── components/         # React 组件
│   │   ├── Viewer.tsx          # [核心] 3D 渲染引擎、交互逻辑
│   │   ├── JointController.tsx # 关节角度控制滑块
│   │   ├── InfoPopup.tsx       # 浮动信息窗 (矩阵数据显示)
│   │   └── DisplayOptions.tsx  # 可视化选项开关
│   ├── App.tsx             # [入口] 状态管理、布局容器
│   └── style.css           # 全局样式
├── package.json            # 项目依赖与脚本
└── vite.config.ts          # Vite 配置 (含 Proxy 转发)
```

### 3.2 核心组件功能

#### `App.tsx` (中央控制器)
*   **状态管理**: 持有 `robot` 对象、`urdfContent` (XML字符串)、`selection` (当前选中项信息)、`displayOptions` (显示配置)。
*   **数据获取**: 初始化时从后端 API 拉取示例列表；处理文件上传。
*   **Xacro 远程解析**: 集成 `/api/xacro-to-urdf` 接口调用，将复杂的 Xacro 拼装逻辑移至后端执行，确保与标准 ROS 路径解析一致。
*   **布局**: 组织侧边栏与主视口。

#### `Viewer.tsx` (3D 渲染引擎)
*   **场景初始化**: 创建 Scene, Camera, Renderer, Lights, Grid, Axes。
*   **模型管理**: 监听 `robot` prop 变化，负责将机器人模型添加/移除出场景，并修正坐标系 (Z-up 转 Y-up)。
*   **交互逻辑 (Raycasting)**:
    *   监听 `contextmenu` (右键) 事件。
    *   实现射线检测，向上遍历对象树查找 `isURDFLink` 或 `isURDFJoint` 属性，精准拾取机器人部件。
    *   **高亮系统**: 使用材质替换 (`MeshBasicMaterial`) 实现选中高亮，支持透明度与深度测试关闭 (DepthTest false)。
*   **性能优化**: 使用 `useRef` 存储回调函数和状态，确保 `requestAnimationFrame` 循环中始终访问最新数据，避免 Stale Closure 问题。
*   **实时更新**: 在渲染循环中调用 `updateWorldMatrix`，并实时通过 `onMatrixUpdate` 回调将矩阵数据传回 UI。

#### `JointController.tsx` (运动学控制)
*   **动态生成**: 解析 `robot.joints`，自动过滤 `fixed` 关节。
*   **类型适配**: 根据关节类型 (`revolute`, `prismatic`, `continuous`) 自动适配滑块的单位 (度/米) 和范围。
*   **驱动**: 直接操作 `robot.setJointValue()` 驱动模型运动。

#### `InfoPopup.tsx` (数据可视化)
*   **数学可视化**: 将 4x4 变换矩阵分解为 位置 (XYZ)、欧拉角 (RPY)、四元数 (Quaternion)。
*   **交互**: 支持拖拽移动 (Draggable)。
*   **智能定位**: 采用“本地状态优先 + 结束同步”策略，解决拖拽不跟手问题；修正了父容器 `relative` 定位导致的坐标偏移。

---

## 4. 关键技术实现细节

### 4.1 URDF 加载与坐标系校正
*   **加载**: 使用 `FileLoader` 读取文本，`URDFLoader.parse` 进行解析。
*   **校正**: URDF 标准通常使用 **Z-axis up**，而 Three.js 默认 **Y-axis up**。我们在 `Viewer.tsx` 中对加载的 Robot Object 进行了 `rotation.x = -Math.PI / 2` 旋转，使其直立显示。

### 4.2 交互式拾取 (Picking)
我们没有使用简单的 Mesh 拾取，而是实现了**层级回溯拾取**：
1.  射线击中 Mesh。
2.  循环访问 `object.parent`。
3.  检查属性 `isURDFLink` 或 `isURDFJoint` (由 `urdf-loader` 注入)。
4.  锁定整个逻辑部件而不仅仅是几何面片。

### 4.3 解决 React 与 3D 循环的冲突
在 `Viewer.tsx` 的 `animate` 循环中，不能直接依赖 React 的 props，因为闭包会“捕获”旧值。
**解决方案**:
```typescript
const onMatrixUpdateRef = useRef(onMatrixUpdate);
// 每次渲染更新 Ref
useEffect(() => { onMatrixUpdateRef.current = onMatrixUpdate; }, [onMatrixUpdate]);
// 循环中使用 Ref 调用
const animate = () => {
  // ...
  onMatrixUpdateRef.current(...);
}
```

### 4.4 浮动窗的拖拽算法
为了实现完美的拖拽体验，采用了**父容器相对坐标修正**算法：
`NewPosition = (MouseClientPos - ParentContainerOffset) - InitialClickOffsetInsidePopup`
这确保了无论父容器如何定位，弹窗都能精确跟随鼠标。

### 4.5 XACRO 动态解析集成 (新增)
项目引入了 `xacro-parser`，实现了在浏览器端直接解析 ROS Xacro 宏文件的能力：
*   **处理流程**: 读取 `.xacro` 文本 -> 解析宏定义 (`xacro:macro`) 与 属性 (`xacro:property`) -> 执行数学运算 (`${...}`) -> 递归展开包含文件 (`xacro:include`) -> 生成标准 URDF 字符串。
*   **后端配合**: 后端 API 自动识别并提供 `.xacro` 文件列表，支持 Xacro 模型与标准 URDF 模型无缝切换。

### 4.6 坐标系逆变换修正 (新增)
由于 Three.js (Y-up) 与 URDF (Z-up) 坐标系的本质冲突，我们实现了**运动学数据逆校正**逻辑：
*   **问题**: 为了直立显示，Robot 对象在渲染器中被旋转了 -90°。
*   **修复**: 在 `InfoPopup` 中提取矩阵时，应用了一个 `+90° X-axis` 的逆变换矩阵。
*   **结果**: 弹窗显示的 Z 坐标真实反映了机器人部件距离地面的高度，符合机器人学直觉。

### 4.7 运动学分析双列布局 (新增)
为了方便调试，Link 信息窗采用了“细长型”仪表盘设计：
*   **Global (World)**: 显示部件相对于世界原点的绝对位置。
*   **Local (Parent)**: 实时计算 `Inverse(ParentMatrix) * CurrentMatrix`，显示部件相对于父连杆的相对位姿。
*   **UI 稳定性**: 使用等宽字体 (`monospace`) 和固定容器宽度，彻底解决了数字正负号切换导致的布局跳动问题。

### 4.8 增强型交互模式 (新增)
实现了基于 **Ctrl 键** 的双模式切换交互：
*   **Link 模式**: 标准右键点击，高亮部件（黄色），查看世界/局部矩阵。
*   **Joint 模式 (Ctrl 切换)**: 按下 Ctrl 键进入关节控制模式，自动显示所有关节轴心。右键点击可高亮特定关节（青色）并弹出独立的控制滑块。
*   **位置记忆**: 系统为 Link 弹窗 and Joint 弹窗分别维护了独立的 Ref 位置记忆，确保用户拖拽后的操作连续性。

### 4.9 后端 XACRO 预拼装引擎 (新增)
为了解决浏览器环境下无法递归加载本地依赖文件的问题，实现了服务端预处理逻辑：
*   **递归合并**: 后端扫描 `<xacro:include>` 标签，自动在服务器侧完成文件的读取与内容嵌套。
*   **ROS 路径模拟**: 完整支持 `$(find pkg_name)` 语法，将 `public/` 目录模拟为 ROS 工作空间根目录。
*   **环境隔离**: 利用 `jsdom` 隔离解析环境，输出“扁平化”后的完整 Xacro 字符串供前端二次解析。

### 4.10 大型项目智能过滤与资源映射 (新增)
*   **入口过滤**: 自动识别子目录下的入口文件，仅显示文件名中包含 `main` 的 Xacro 文件，有效减少下拉菜单冗余。
*   **资源映射**: 前端 `LoadingManager` 拦截所有 `package://` 请求，并自动重定向至后端的 `/api/assets/` 静态资源接口，确保网格模型 (STL/DAE) 的无缝加载。

### 4.11 交互拾取精度优化 (新增)
*   **Helper 优先**: 射线检测优先判定橙色关节标识，解决在复杂网格包裹下难以选中关节的问题。
*   **深度测试关闭**: 关节标识始终置顶显示，支持“透视点击”，提升了多连杆机器人的操作效率。

---

## 5. 项目运行指南

得益于 `concurrently` 的配置，项目支持单命令启动。

1.  **安装依赖** (首次运行):
    ```bash
    npm install              # 安装根目录依赖
    cd server && npm install # 安装后端依赖 (含 jsdom, xacro-parser 等)
    ```

2.  **启动开发环境**:
    ```bash
    npm run dev
    # 该命令会同时启动 Vite (5173) 和 Express (3001)
    ```

3.  **ROS 项目部署**:
    只需将完整的 ROS 包（含 urdf 和 meshes 文件夹）放入 `public/` 目录下即可自动识别。

3.  **访问**: 打开浏览器访问 `http://localhost:5173`。

---

## 6. 未来演进路线 (Roadmap)

基于当前坚实的基础，项目计划向更高级的机器人学分析工具演进：

1.  **正向运动学 (已完成)**: 实时显示变换矩阵与位姿，支持双列（全局/局部）对比。
2.  **XACRO 全面兼容 (已完成)**: 浏览器端宏解析与动态生成。
3.  **逆向运动学 (IK)**: 集成 IK 解算器，允许通过拖拽末端执行器 (End Effector) 来反向驱动关节。
4.  **动力学分析**: 可视化雅可比矩阵 (Jacobian Matrix)，通过颜色热力图显示机器人的可操作度 (Manipulability) 和奇点 (Singularity)。
5.  **轨迹规划**: 支持关键帧录制与回放。

---
*Generated by Gemini CLI Agent - 2025*
