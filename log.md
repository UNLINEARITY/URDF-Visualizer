这是一份日志文件 log ，如用户有需要，你应该将最近几次的修改加入到此文件当中
- 重要：没有用户的明确指示，你不应该主动修改此文件，不得做出任何修改！！！
- 由于日志可能过长，你不用全部阅读，仅需阅读部分内容，你可以学习仿照相关的格式
- 每次将新的日志放置在开头，也就是此行说明的下面（防止上下文爆炸）

## [2026-07-29] 新增独立 STL/STEP/STP 可视化并修复拖拽遮罩

### 用户提出的问题
1. 希望在现有 URDF 可视化器中直接查看 STL 与 STEP/STP CAD 文件。
2. 直接拖入 STEP 文件后，模型虽已加载，但“Drop a Robot Project or STL / STEP / STP File Here”遮罩持续显示。

### 问题原因/修改思路
- STEP 需要浏览器端 CAD 解析能力；采用 OpenCascade WASM 按需加载，将 STEP 网格化后交给现有 Three.js 视图渲染，避免影响常规 URDF/STL 首屏。
- 直接文件的拖入分支绕过了原有的拖拽状态收尾逻辑；在该分支复用 `handleDragLeave`，确保遮罩状态复位。

### 实际修改记录
- **`src/utils/modelLoader.ts`**、**`src/hooks/useStandaloneModelLoader.ts`**、**`src/types/occt-import-js.d.ts`**：新增 STL 与 STEP/STP 的本地解析、Three.js 网格转换和异步加载状态管理。
- **`src/App.tsx`**、**`src/components/Viewer.tsx`**、**`src/style.css`**：新增独立 CAD 文件选择与拖入入口、加载文件名提示和自动取景；修复直接拖入 CAD 文件后拖拽遮罩不关闭的问题。
- **`package.json`**、**`package-lock.json`**：新增 `occt-import-js` 依赖；STEP WASM 仅在实际打开 STEP/STP 时加载。
- **`src/hooks/useRobotLoader.ts`**、**`README.md`**：切换至独立模型时释放旧机器人 Blob URL，并补充独立 CAD 查看说明。

### 验证
- ✅ `npm run typecheck` 通过
- ✅ `npm run lint` 通过
- ✅ `npm run test`：20 项测试通过
- ✅ `npm run build` 通过，STEP WASM 被产出为独立资源
- ✅ 使用 `occt-import-js` 的 STEP 立方体样例完成解析验证


## [2026-07-22] UI 图标改用 lucide-react 替换 emoji

### 用户提出的问题
1. 原 emoji 图标（▶/◀、📄、📁、▶️/⏸️、📏、☀️、🌳）风格不统一、偏丑。

### 问题原因/修改思路
- emoji 为彩色字符，跨平台显示不一致、难统一配色；→ 改用 lucide-react 单色矢量图标库，继承按钮 color，风格统一且可随状态变色。

### 实际修改记录
- **`src/App.tsx`**：import lucide 图标，替换全部 emoji：
  - 侧边栏折叠 ▶/◀ → ChevronRight / ChevronLeft
  - 选文件 📄 → FileUp；选文件夹 📁 → FolderUp
  - 关节动画 ▶️/⏸️ → Play / Pause
  - 测量 📏 → Ruler；阴影 ☀️ → Sun；结构树 🌳 → Network
- **`package.json`**：新增依赖 lucide-react

### 验证
- ✅ npm run typecheck / lint（0 warning）/ build 全绿
- ✅ tree-shake 后 bundle 仅 +~8KB
- ✅ 本地实测图标显示正常


## [2026-07-22] 前端全面升级：性能/内存优化、类型安全、文件夹上传修复、关节动画功能

### 用户提出的问题
1. 项目前后端存在很多不足，需全面升级（性能、内存、类型安全、工程化）。
2. 重构后失去了“上传整个文件夹”的能力。
3. 缺少 animate（关节自动演示动画）功能；且暂停后再继续会从零开始，希望从暂停处继续。

### 问题原因/修改思路
- **性能/内存**：Viewer 动画循环每帧 setState 推送矩阵导致频繁重渲染；切换模型时旧机器人 GPU 资源未释放。→ RAF 节流（~15Hz）+ 仅弹窗可见时推送；卸载时完整 dispose。
- **文件夹上传失效根因**：重构时把 mesh 加载从 urdf-loader 默认加载器换成自定义 createMeshLoader，后者对 resolvePath 产生的 `/pkg/...` 路径误判为远程并做 HEAD 预检，dev server 404 导致 mesh 全部静默丢失。→ 仅对真正 http(s) URL 做 HEAD 预检。
- **animate 暂停重置**：原用“启动时刻”算相位，暂停→继续重置进度。→ 改用累积播放头 elapsedRef，仅换模型时归零。

### 实际修改记录
- **`src/components/Viewer.tsx`**（重写）：
  - 删除冗余 onMatrixUpdate；矩阵更新 RAF 节流且仅在 InfoPopup 可见时推送
  - 切换/卸载机器人时 disposeObject3D 完整释放；卸载时释放高亮材质/阴影平面/measurement 贴图/controls/renderer，移除全部事件拦截器
  - 用 urdfTypes 守卫替换全部 (x as any) 断言
- **`src/utils/robotLoader.ts`**：
  - 修复文件夹上传：createMeshLoader 仅对 http(s) 做 HEAD 预检 + 空路径防御
  - loadCollision（不存在的 API）→ parseCollision
  - disposeObject3D 泛化：支持 Line/Sprite 等任意带 geometry/material 的对象
- **`src/components/InfoPopup.tsx`**：修复 Hooks 早返回导致的调用顺序违规（崩溃 bug）；offsetRef/joint.parent 强类型化
- **`src/components/StructureTree.tsx`**：用共享守卫替换本地 as any
- **`src/hooks/useJointAnimation.ts`**（新增）：关节自动演示动画，不同频率/相位正弦波，暂停/继续从断点恢复
- **`src/hooks/useKeyboardShortcuts.ts`** + **`src/App.tsx`**：接入 A 键与 ▶️/⏸️ 浮动按钮
- **`src/utils/__tests__/`**（新增）：fileUtils / xacroProcessor / urdfTypes 共 20 项单元测试
- **工程化**：ESLint9 / Prettier / Vitest(jsdom) / GitHub Actions CI（lint→typecheck→test→build）

### 验证
- ✅ npm run typecheck 通过
- ✅ npm run lint：0 error / 0 warning
- ✅ npm run test：20 passed
- ✅ npm run build：成功（three/react/urdf 分包）
- ✅ 本地实测：文件夹上传恢复、关节动画播放/暂停/继续正常
