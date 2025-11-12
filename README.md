# URDF Online Viewer

一个基于 Three.js 的在线 URDF（Unified Robot Description Format）查看器。

## 功能特点

- 📁 拖放上传 URDF 文件或文件夹（仅 Chrome）
- 🤖 支持查看机器人模型（如 UR5e）
- 🎨 可视化关节运动和碰撞检测
- 🔧 可调节关节参数和显示设置

## 在线演示

访问：https://daoming-chen.github.io/urdf_online_viewer/

## 本地开发

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 预览生产构建

```bash
npm run preview
```

## 技术栈

- [Vite](https://vitejs.dev/) - 构建工具
- [Three.js](https://threejs.org/) - 3D 渲染库
- [urdf-loader](https://github.com/gkjohnson/urdf-loaders) - URDF 加载器

## 许可证

ISC
