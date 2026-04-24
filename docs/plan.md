这是一个基于 Tauri 的全景图浏览器与多视角截图工具的架构与实现方案。考虑到你需要跨平台（Windows/macOS）以及对图像和 3D 渲染的具体要求，核心思路是将 **3D 渲染和交互交由前端（Three.js）处理，将文件读写、高分辨率图像合成交由后端（Rust）处理**。

### 一、 技术栈选型

* **框架**: Tauri v2 (或 v1，视你当前习惯而定)
* **前端**: Vue 3 / React + TypeScript
* **3D 引擎**: Three.js (处理 Equirectangular Projection 等距柱状投影和相机控制)
* **后端 (Rust)**:
    * `tauri` (进程间通信 IPC 与原生窗口管理)
    * `image` crate (用于后端的图片拼接与格式转换)
    * `rfd` crate (可选，用于原生文件选择/保存对话框)

---

### 二、 核心功能实现方案

#### 1. 全景图的 3D 空间还原与浏览

全景图（通常是 2:1 比例的等距柱状投影图）的 3D 还原在图形学上的标准做法是“内视球体映射”。

* **场景构建**: 在 Three.js 中创建一个 `SphereGeometry`（球体几何），将其 `scale.x` 设置为 `-1`，实现将材质贴图翻转到球体内部。
* **材质加载**: 用户通过 Tauri 的文件选择器选中本地图片后，利用 Tauri 的 `convertFileSrc` 将本地绝对路径转换为 Webview 可读取的自定义协议（如 `asset://`），并使用 `TextureLoader` 将其作为材质贴图加载到球体上。
* **相机与控制器**: 将 `PerspectiveCamera`（透视相机）放置在球体坐标原点 `(0, 0, 0)`。引入 Three.js 提供的 `OrbitControls`，禁用平移（Pan）和缩放（Zoom），仅保留旋转（Rotate），即可实现鼠标拖拽的 360° 环绕浏览。

#### 2. “前、后、左、右” 四向截图功能

这是该方案的核心难点。为了保证截图分辨率不受当前窗口大小限制，且保持严格的 16:9 比例，**不能直接截取当前屏幕的 Canvas**，而是需要使用离屏渲染（Offscreen Rendering）。

**拍摄逻辑与相机控制：**
当用户按下截图键时，记录当前相机的偏航角（Yaw / 围绕 Y 轴的旋转角度）和俯仰角（Pitch / 围绕 X 轴的旋转角度）。为了保证前、后、左、右四张图的视野水平对齐，通常在拍摄这四张图时需要将 Pitch 强制归零（即看向地平线），只改变 Yaw 角度。

* **前 (Front)**: Yaw = 当前角度 $\theta$
* **左 (Left)**: Yaw = $\theta + \pi/2$
* **后 (Back)**: Yaw = $\theta + \pi$
* **右 (Right)**: Yaw = $\theta - \pi/2$

**离屏渲染（WebGLRenderTarget）工作流：**
1. 实例化一个高分辨率的 `WebGLRenderTarget`（例如 1920x1080，满足 16:9）。
2. 暂存主相机的状态，将相机的 Aspect 设为 16:9，FOV 设置为 90°（或者用户自定义的视野大小）。
3. 循环四次，每次将相机旋转到上述对应的角度，调用 `renderer.setRenderTarget(target)` 并执行 `renderer.render(scene, camera)`。
4. 使用 `renderer.readRenderTargetPixels` 读取像素数据，将其转换为 Base64 或 Blob 数据。
5. 恢复主相机的原始状态和 RenderTarget，避免打断用户的正常浏览。

#### 3. 图片的单张下载与合并（Rust 端处理）

考虑到高分辨率图片（如 4 张 4K 图片拼接）在浏览器前端处理会大量消耗内存甚至导致 Webview 崩溃，合并和保存操作应通过 IPC 交给 Rust 后端执行。

* **数据传递**: 前端将 4 张图片的 Base64 数据或字节数组通过 Tauri 的 `invoke` 发送给 Rust 端。
* **单张保存**: Rust 端接收到数据后，通过 `base64` 解码并直接利用标准的 `std::fs` 写入用户指定的本地目录。
* **合并大图**: 
    * 使用 Rust 的 `image` crate。
    * 如果是横向合并（1x4 排列），创建一个宽度为 `w * 4`，高度为 `h` 的空白 ImageBuffer。
    * 如果是田字合并（2x2 排列），创建一个宽度为 `w * 2`，高度为 `h * 2` 的空白 ImageBuffer。
    * 使用 `image::imageops::overlay` 将 4 张图片分别绘制到对应的坐标偏移量上，最后输出为单张 JPEG/PNG。

---

### 三、 性能与架构注意点

1. **WebGL 纹理尺寸限制 (Max Texture Size)**
   普通全景图分辨率极高（通常为 8K 甚至 16K）。大部分设备的 WebGL 支持的最大纹理尺寸（`MAX_TEXTURE_SIZE`）通常为 8192 或 16384。在前端加载纹理前，建议在 Rust 端先读取全景图的分辨率，如果超出硬件限制，利用 Rust 的 `image` crate 在内存中进行降采样（Downsampling）后再传给前端显示，防止 WebGL 渲染崩溃。

2. **CORS 与本地文件读取**
   由于 Tauri 运行在 `http://localhost` 或 `tauri://localhost` 协议下，直接使用 Three.js 加载本地磁盘路径会触发跨域错误。必须在 `tauri.conf.json` 中配置 `fs` 的 scope 权限，并使用前端 API `@tauri-apps/api/tauri` 中的 `convertFileSrc` 函数包装路径。

3. **内存泄漏防护**
   在用户切换全景图时，Three.js 中的 `Texture`、`Material` 和 `Geometry` 不会被 JavaScript 垃圾回收机制自动清理。必须手动调用它们的 `.dispose()` 方法，否则在多次切换大分辨率图片后应用会导致严重的内存泄漏。


---

### 四、 借鉴现有项目

在UI和部分功能实现上，可以借鉴已经存在的 Tarui 项目
"C:\Users\Hong\Documents\Works_temp\laymask"