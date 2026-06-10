# Material Texture Effect Device

一个网页端材质肌理效果器，用于给 PNG / JPG 图案快速添加粗糙刻印、内发光、撕边、颗粒、肌理蒙版等视觉效果。

用户可以上传自己的图案，也可以额外上传肌理图片，通过参数调节生成不同的材质效果，适合用于字体设计、Logo 设计、海报标题、插画图形和视觉实验。

## 功能特点

* 支持上传 PNG / JPG 图案
* 支持上传自定义肌理图片
* 支持实时预览效果
* 支持粗糙刻印效果
* 支持内发光 / 中心模糊效果
* 支持撕边肌理效果
* 支持图案反相
* 支持肌理反相
* 支持参数化调节
* 支持导出处理后的图片

## 主要效果

### 1. 粗糙刻印效果

模拟图案被粗糙材质刻印后的视觉效果，包含颗粒、破损、粗糙边缘和刻线质感。

可调参数包括：

* 效果强度
* 粗糙程度
* 颗粒大小
* 刻线密度
* 刻线角度
* 对比度
* 随机纹理

### 2. 内发光效果

模拟 Photoshop 中的 Inner Glow 效果，尤其是 Source: Center 的中心模糊发光效果。

可调参数包括：

* 发光颜色
* 发光强度
* 发光范围
* 中心模糊程度
* 发光扩散
* 发光透明度

### 3. 撕边肌理效果

通过肌理图片或内置噪声生成撕裂、破损、掉墨等效果，使图案呈现更自然的手工质感。

可调参数包括：

* 肌理强度
* 肌理缩放
* 肌理阈值
* 撕边强度
* 撕边细节
* 肌理反相
* 图案反相

## 使用方式

1. 上传一张 PNG / JPG 图案
2. 选择想要的材质效果
3. 根据需要上传肌理图片
4. 调整右侧参数
5. 在画布中实时预览效果
6. 导出最终图片

## 本地运行

确保你已经安装 Node.js。

```bash
git clone https://github.com/yeyeshanye-max/Material-Texture-Effect-Device.git
```

进入项目目录：

```bash
cd Material-Texture-Effect-Device
```

安装依赖：

```bash
npm install
```

启动项目：

```bash
npm run dev
```

然后在浏览器中打开终端提示的本地地址。

通常是：

```bash
http://localhost:5173
```

## 项目结构

```text
Material-Texture-Effect-Device
├── src
│   ├── components      # 页面组件
│   ├── effects         # 材质效果算法
│   ├── utils           # 图片处理工具函数
│   ├── config          # 参数配置
│   └── App.tsx         # 主页面
├── public              # 静态资源
├── package.json
└── README.md
```

## 技术栈

* React
* TypeScript
* Canvas
* Vite

## 适用场景

* 字体设计质感处理
* Logo 粗糙化处理
* 海报标题视觉实验
* 插画图形材质叠加
* 复古印刷风格设计
* 怪诞 / 暗黑 / 手作风视觉效果

## 后续计划

* 增加更多材质预设
* 支持多效果叠加
* 支持批量导出
* 支持 SVG 输入
* 支持保存参数预设
* 增加纸张、布料、金属等更多材质类型

## License

This project is for personal design experiments and learning purposes.
