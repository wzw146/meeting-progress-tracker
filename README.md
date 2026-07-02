# 会议全流程进度跟踪 - 部署指南

## 本地运行（测试用）

双击 `start.bat` 即可启动服务，打开浏览器访问 http://localhost:3456

## 部署到公网（推荐方案）

### 方案一：部署到 Render（最简单，免费）

1. 打开 https://render.com 注册免费账号
2. 点击 "New +" → "Web Service"
3. 连接你的 GitHub 仓库
   - 如果还没有仓库，先创建一个 GitHub 仓库，把 server/ 文件夹里的所有文件上传
4. 填写部署信息：
   - Name: `meeting-tracker`
   - Region: 选 Singapore（新加坡，国内访问较快）
   - Branch: `main`
   - Build Command: 保持空
   - Start Command: `node server.js`
   - Instance Type: 选 Free
5. 点击 "Create Web Service"
6. 等待几分钟，部署完成后你会得到一个 `https://meeting-tracker.onrender.com` 的地址
7. 把这个地址发给同事，所有人打开就能一起用

### 方案二：部署到 Railway（类似 Render）

1. https://railway.app 注册
2. 创建新项目 → Deploy from GitHub repo
3. Start Command 设为 `node server.js`
4. 部署完成后获得公网地址

### 方案三：使用隧道工具（你电脑需保持开机）

如果不方便部署到云端，可以在自己电脑上跑：

1. 双击 `start.bat` 启动服务
2. 打开 https://natapp.cn 注册并下载 natapp（国内速度快）
3. 配置 natapp 隧道，本地端口填 3456
4. 启动 natapp，获得公网地址

或者用 https://ngrok.com（国际版，国内可能较慢）

## 数据说明

所有会议数据保存在 `meetings-data.json` 文件中。你可以：
- 随时备份这个文件
- 迁移到新服务器时带上它
- 手动编辑（如果熟悉 JSON 格式）

## 文件结构

```
server/
├── server.js          # 后端服务（核心）
├── index.html         # 前端页面
├── package.json       # 配置文件（用于云端部署）
├── meetings-data.json # 数据文件（自动生成）
├── start.bat          # 快速启动脚本
└── README.md          # 本说明文件
```
