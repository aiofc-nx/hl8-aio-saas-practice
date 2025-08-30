---
description: 
globs: 
alwaysApply: true
---

// 本文件由 Nx Console 自动生成

您当前处于使用 Nx 21.4.1 和 pnpm 作为包管理器的 Nx 工作空间中。

您可访问 Nx MCP 服务器及其提供的工具。请充分利用这些工具。遵循以下准则以最佳方式协助用户：

# 通用准则
- 回答问题时，优先使用 nx_workspace 工具来了解工作空间架构
- 涉及 Nx 配置、最佳实践或存在不确定性的问题时，使用 nx_docs 工具获取相关的最新文档！！务必使用该工具而非主观推测 Nx 配置
- 若用户需要解决 Nx 配置或项目图错误，使用 'nx_workspace' 工具获取错误信息
- 如需解答工作空间结构相关问题或展示任务依赖关系，使用 'nx_visualize_graph' 工具

# 生成准则
若用户需要生成内容，请按以下流程操作：

- 使用 'nx_workspace' 工具及适用的 'nx_project_details' 工具了解 Nx 工作空间详情和用户需求
- 通过 'nx_generators' 工具获取可用生成器
- 确定合适的生成器。若无相关生成器，通过 'nx_available_plugins' 工具检查是否可安装插件满足需求
- 使用 'nx_generator_schema' 工具获取生成器详细信息
- 不确定时可使用 'nx_docs' 工具了解特定生成器或技术细节
- 确定实现用户请求所需的最简选项配置，避免主观假设
- 通过 'nx_open_generate_ui' 工具打开生成器界面
- 等待用户完成生成操作
- 使用 'nx_read_generator_log' 工具读取生成器日志文件
- 根据日志信息解答用户问题或继续后续操作

# 运行任务准则
若用户需要任务或命令相关帮助（包含"test", "build", "lint"等关键词的操作），请按以下流程操作：
- 使用 'nx_current_running_tasks_details' 工具获取任务列表（包含已完成、已停止或失败的任务）
- 若存在任务，询问用户是否需要特定任务的帮助，随后使用 'nx_current_running_task_output' 工具获取该任务/命令的终端输出
- 通过 'nx_current_running_task_output' 的终端输出分析问题并协助修复，必要时使用相应工具
- 若用户需要重新运行任务或命令，始终使用 `nx run <taskId>` 在终端中重新执行，这将确保任务在 Nx 上下文中按原始方式运行
- 若任务标记为"continuous"（持续运行），无需提议重新运行。该任务已在运行中，用户可在终端查看输出。可通过 'nx_current_running_task_output' 获取任务输出进行验证

# CI 错误处理准则
若用户需要修复 CI 管道中的错误，请按以下流程操作：
- 使用 'nx_cloud_cipe_details' 工具获取当前 CI 管道执行（CIPE）列表
- 若存在错误，使用 'nx_cloud_fix_cipe_failure' 工具获取特定任务的日志
- 通过任务日志分析问题并协助修复，必要时使用相应工具
- 通过运行传入 'nx_cloud_fix_cipe_failure' 工具的任务来确认问题已解决