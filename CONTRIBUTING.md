# 开发与贡献

Python服务无第三方依赖，前端和扩展无构建步骤。测试需要Python 3.10+、Node.js 20+。

在仓库根目录运行：

```sh
python -m unittest discover -s tests -v
node tests/parser.test.cjs
node tests/adapters.test.cjs
node tests/theme.test.cjs
node tests/ui-feedback.test.cjs
node tests/tap-feedback.test.cjs
node --check web/app.js
node --check extension/panel.js
node --check extension/adapters.js
```

Windows启动脚本采用ASCII内容、CRLF换行。启动测试包含中文与空格目录，并验证最外层CMD入口。Linux会跳过Windows启动器测试。

页面适配问题请提供平台、页面类型、扫描轮数、错误提示与遮挡隐私后的截图。请勿发送连接密钥、Cookie、个人完整导出、数据库或签名私钥。

修改适配器时增加合成DOM测试，真实页面验证单独记录覆盖范围。不要把真实收藏写入测试夹具。PR提交前执行`git diff --check`并检查暂存文件，确认data与私人备份不在其中。

GitHub Actions 示例在`docs/ci-tests.yml.example`。如需在自己的fork启用，可将其复制到`.github/workflows/tests.yml`。本仓库首次发布所用OAuth授权没有workflow写入范围，因此未启用远端CI；这不影响本地运行测试。
