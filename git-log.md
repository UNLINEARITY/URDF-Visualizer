这是一个git commit log 文件，如果用户有需要，你应该读取同级的 log.md 文件的最新一次日志，并撰写对应的 git commit 的 summary和 description
- 重要：没有用户的明确指示，你不应该主动修改此文件，不得做出任何修改！！！
- 由于日志可能过长，你不用全部阅读，仅需阅读部分内容，你可以学习仿照相关的格式
- 每次将新的日志放置在开头，也就是此行说明的下面（防止上下文爆炸）

## [2026-07-29] fix: normalize camera framing across model formats

**commit summary**
fix: normalize camera framing across model formats

**description**
Adapt the camera near and far clipping planes to the OrbitControls viewing distance so close STL inspection no longer clips nearby faces while preserving depth-buffer precision. Reframe every newly loaded model, including URDF and Xacro, instead of only standalone CAD files so switching formats cannot inherit an unsuitable camera distance. The clipping update uses a small threshold to avoid unnecessary projection-matrix updates during rendering. Typecheck, lint, and all 20 unit tests pass.

根据 OrbitControls 的观察距离动态调整相机近远裁剪面，使 STL 近距离查看不再裁掉靠近镜头的面，同时保持深度缓冲精度。所有新加载模型（包括 URDF 与 Xacro）都会统一自动取景，而不再仅对独立 CAD 文件生效，避免切换格式时继承不合适的相机距离。裁剪面更新设有小阈值，避免渲染过程中不必要地更新投影矩阵。类型检查、ESLint 和全部 20 项单元测试均已通过。

## [2026-07-29] feat: add standalone STL and STEP model viewer

**commit summary**
feat: add standalone STL and STEP model viewer

**description**
Add direct STL, STEP, and STP viewing through file selection and drag-and-drop while preserving the existing URDF/Xacro workflow. Convert STEP geometry locally with a lazily loaded OpenCascade WASM module, render the resulting meshes in the existing Three.js scene, and automatically frame standalone models without adding STEP startup cost for normal visitors. Show the active CAD filename and keep grid, shadows, wireframe, and measurement available for standalone models. Fix the direct CAD drop path to clear the drag overlay after a successful drop; typecheck, lint, 20 unit tests, production build, and a STEP parsing sample all pass.

新增通过文件选择与拖拽直接查看 STL、STEP 和 STP 的能力，同时保留原有 URDF/Xacro 工作流。使用按需加载的 OpenCascade WASM 在浏览器本地转换 STEP 几何，并在现有 Three.js 场景中渲染；独立模型自动取景，普通访问者不会承担 STEP 解析器的启动成本。独立模型界面会显示当前 CAD 文件名，并继续支持网格、阴影、线框和测量功能。修复直接拖入 CAD 文件后遮罩未关闭的问题；类型检查、ESLint、20 项单元测试、生产构建和 STEP 样例解析均已通过。


## [2026-07-22] refactor: replace emoji icons with lucide-react

**commit summary**
refactor: replace emoji icons with lucide-react

**description**
Replace every emoji icon in App.tsx with a single-color lucide-react vector icon for consistent, theme-aware visuals. Sidebar collapse, file/folder upload, joint animation, measurement, shadows, and structure-tree buttons now use ChevronLeft/Right, FileUp, FolderUp, Play/Pause, Ruler, Sun, and Network respectively; icons inherit the button color. Add lucide-react as a dependency; tree-shaking keeps the bundle impact around 8KB.

将 App.tsx 中所有 emoji 图标替换为 lucide-react 单色矢量图标，视觉风格统一且随按钮配色变化。侧边栏折叠、选文件/选文件夹、关节动画、测量、阴影、结构树按钮分别改用 ChevronLeft/Right、FileUp、FolderUp、Play/Pause、Ruler、Sun、Network，图标继承按钮 color。新增 lucide-react 依赖，经 tree-shake 后 bundle 仅增加约 8KB。


## [2026-07-22] feat: add joint auto-demo animation and restore folder upload

**commit summary**
feat: add joint auto-demo animation and restore folder upload

**description**
Add a joint auto-demo animation hook (play/pause floating button and A shortcut) that sweeps every movable joint through its limits with per-joint frequency and phase, resuming from the paused pose via an accumulated playhead. Restore folder upload by restricting the mesh loader's HEAD preflight to real http(s) URLs so resolvePath's /pkg paths route through the URL modifier to local blobs instead of 404ing on the dev server. Rewrite the Viewer to throttle matrix updates with requestAnimationFrame, fully dispose GPU resources on robot swap/unmount, and replace any-casts with typed guards; generalize disposeObject3D to lines and sprites, fix the InfoPopup hooks-order crash, and add unit tests plus lint/typecheck/test CI.

新增关节自动演示动画 hook（▶️/⏸️ 浮动按钮与 A 快捷键），按各关节不同频率与相位在限位范围内往复运动，并通过累积播放头实现从暂停位置续播。修复文件夹上传：mesh 加载器的 HEAD 预检仅对真正的 http(s) URL 生效，使 resolvePath 产生的 /pkg 路径经 URL modifier 解析到本地 blob，不再因 dev server 404 静默丢失网格。重写 Viewer：矩阵更新改用 requestAnimationFrame 节流、切换/卸载时完整释放 GPU 资源、以类型守卫替换 as any；disposeObject3D 泛化支持 Line/Sprite，修复 InfoPopup 的 Hooks 调用顺序崩溃，并补充单元测试与 lint/typecheck/test CI。
