# GitHub 与在线部署

## 交付状态

已创建个人私有仓库 [bright-peng/cube-lab](https://github.com/bright-peng/cube-lab)，归属于个人账号 `bright-peng`。自动构建结果与离线版下载见 [Actions](https://github.com/bright-peng/cube-lab/actions)。尚未启用 Pages，也没有部署在线网址。

当前仓库后续提交改动后运行 `git push origin main` 即可自动构建。下面两种建仓库方案仅用于首次发布其他副本，不要在已有 `origin` 的当前仓库重复执行。

## 方案 A：官方 GitHub CLI 发布

前提是已安装 Git、Node.js 和官方 GitHub CLI，且 Git 的提交姓名、邮箱已配置。认证请在本机执行，不要把 Token 放入聊天或仓库。

```bash
cd cube-lab
gh auth login
npm test
npm run build
sh scripts/publish-github.sh cube-lab private
```

发布脚本默认 `private`，会展示将创建的名称与可见性，要求确认，已有 `origin` 时拒绝覆盖，也不会删除任何已有远程仓库。

需要公开源码时，显式运行：

```bash
sh scripts/publish-github.sh cube-lab public
```

**public 表示任何人都能看见源码。** 请自己决定是否公开。仓库建立在当前 GitHub CLI 已登录账号之下，不猜测用户名。

脚本使用官方 `gh repo create --source=. --remote=origin --push` 流程，参见 [GitHub CLI 文档](https://cli.github.com/manual/gh_repo_create)。若账号已有同名仓库，CLI 会报错；换一个名称，或自行检查后关联已有仓库，不要强行覆盖。

## 方案 B：网页创建仓库，使用 Git 推送

在 GitHub 新建空仓库，自行选择公开或私有。不要初始化额外 README、License 或 gitignore。进入解压后的项目目录：

```bash
git init -b main
git add .
git commit -m "Build Cube Lab with 3D views and formula tutor"
git remote add origin <GitHub页面提供的真实仓库地址>
git push -u origin main
```

仓库导入流程参考 [GitHub 官方说明](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github)。

## 开启 GitHub Pages

自动构建由 `.github/workflows/ci.yml` 负责：每次推送、Pull Request 和手动触发都会检查、测试并构建。成功后在 Actions 运行页面的 Artifacts 下载 `cube-lab-offline`，解压得到可离线打开的 `index.html`，保留 14 天。项目没有 npm 依赖，不需要 `npm install`、缓存或额外密钥。

如需公开网站，进入新仓库 `Settings → Pages → Build and deployment → Source → GitHub Actions`，再到 `Actions` 选择 `main` 分支，手动运行 **Deploy Cube Lab to Pages**。

`.github/workflows/pages.yml` 会依次运行测试、检查、构建，随后上传 `dist` 并部署。仅接受 `main` 分支的手动触发；Pages 写入权限只授予部署任务。自动构建不依赖 Pages 设置，首次推送不会尝试发布网站。该部署工作流尚未在真实仓库验证。

公开仓库可在 GitHub Free 使用 Pages；私有仓库是否可用取决于 GitHub 计划与组织政策，详见 [GitHub Pages 自定义工作流文档](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。不要把私有仓库默认等同于私密网站；站点可见性还需单独确认。

成功后的真实网址由部署步骤输出，并显示在仓库的 Pages 设置中。本文不虚构账号名或可访问 URL。

## 其他静态托管

`npm run build` 生成的 `dist/index.html` 是单文件。支持静态 HTML 的服务器可直接托管，不需要 Node 作为生产运行时。若服务器配置严格 CSP，需要允许内联脚本/样式和 `worker-src blob:`，或自行把脚本拆分并配置 nonce/hash。不要为本项目在已有安全站点上直接全局关闭 CSP。

本地开发入口和单文件构建入口不同：源码 `index.html` 需要 HTTP 服务；分发文件是 `dist/index.html`。本地服务仅监听 `127.0.0.1`，不会默认暴露到局域网或互联网。
