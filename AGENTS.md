1. # AGENTS.md

   ## 项目名称

   Knowledge Cards —— Markdown 驱动的个人知识卡片库。

   本项目是一个纯前端、无后端、无云端数据库的个人知识管理与展示系统。

   核心思想：

   > Markdown 是唯一正式数据源，React 是展示层，JSON 是构建索引，Git 是版本控制。

   ------

   ## 一、核心目标

   项目需要实现：

   - Markdown 知识内容管理
   - QA 类型知识卡片
   - Markdown 实时预览
   - KaTeX 数学公式
   - GFM
   - 代码高亮
   - 搜索
   - 标签筛选
   - 分类浏览
   - 卡片正反面展示
   - 多主题系统
   - 长文本连续阅读
   - PNG/JPG/WebP/SVG 导出
   - 响应式设计
   - PWA
   - Android / Capacitor 兼容
   - GitHub Pages 部署

   ------

   ## 二、核心架构原则

   必须遵守：

   ```text
   Markdown → Parser → Renderer → Theme → Card → Export
   ```

   不得引入不必要的后端服务。

   默认情况下：

   - 不使用数据库服务器
   - 不使用云端 API
   - 不依赖登录系统
   - 不依赖第三方内容 API
   - 不把 IndexedDB 当作正式数据源

   ------

   ## 三、数据源原则

   正式知识数据必须保存在：

   ```text
   content/**/*.md
   ```

   Markdown + YAML Front Matter 是正式数据格式。

   IndexedDB 只能用于：

   - 编辑草稿
   - 临时状态
   - 本地缓存

   不得把 IndexedDB 数据作为唯一正式数据。

   ------

   ## 四、Markdown 数据规范

   每张知识卡必须具有：

   ```yaml
   ---
   schemaVersion: 1
   id: unique-id
   type: qa
   title: title
   category: category
   tags:
     - tag
   status: published
   ---
   ```

   可选字段：

   ```yaml
   subcategory:
   difficulty:
   theme:
   aliases:
   related:
   created:
   updated:
   ```

   ------

   ## 五、ID 规则

   每张卡必须具有唯一 ID。

   推荐：

   ```text
   领域-主题-序号
   ```

   例如：

   ```text
   react-hooks-001
   llm-agent-001
   history-ming-001
   ```

   禁止重复 ID。

   ------

   ## 六、状态

   允许：

   ```text
   draft
   review
   published
   archived
   ```

   只有：

   ```yaml
   status: published
   ```

   的内容默认进入公开索引。

   ------

   ## 七、目录结构

   推荐：

   ```text
   content/
   ├── ai/
   ├── programming/
   ├── history/
   ├── philosophy/
   └── other/
   ```

   资源：

   ```text
   assets/
   ├── images/
   ├── fonts/
   └── attachments/
   ```

   源码：

   ```text
   src/
   ├── components/
   ├── pages/
   ├── features/
   ├── lib/
   ├── types/
   └── styles/
   ```

   ------

   ## 八、技术栈

   优先使用：

   - React
   - TypeScript
   - Vite
   - React Router
   - Tailwind CSS
   - shadcn/ui
   - Lucide React
   - react-markdown
   - remark-gfm
   - remark-math
   - rehype-katex
   - rehype-prism-plus
   - CodeMirror 6

   新增依赖前，应确认是否确实有必要。

   ------

   ## 九、Markdown Renderer

   Markdown 渲染必须支持：

   - Heading
   - Paragraph
   - List
   - Ordered List
   - Blockquote
   - Code
   - Code Block
   - Table
   - Task List
   - Image
   - Link
   - Math
   - Inline Math

   不得针对单个主题重新实现 Markdown Renderer。

   ------

   ## 十、主题系统

   主题必须与内容分离。

   禁止：

   ```text
   Theme A → 独立 Card JSX
   Theme B → 独立 Card JSX
   ```

   应采用：

   ```text
   Theme
    ↓
   CSS Variables
    ↓
   Common Card Renderer
   ```

   主题新增原则：

   > 新增主题只修改 themes 配置及相关 CSS，不修改知识卡片业务逻辑。

   ------

   ## 十一、主题变量

   主题至少应支持：

   ```text
   --card-background
   --card-foreground
   --card-primary
   --card-secondary
   --card-border
   --card-code-background
   --card-blockquote
   --card-table
   --card-muted
   ```

   可以进一步支持：

   ```text
   --card-radius
   --card-shadow
   --card-font
   --card-line-height
   ```

   ------

   ## 十二、QA 卡片

   QA 卡片采用：

   ```text
   Front = Question
   Back = Answer
   ```

   展示逻辑：

   ```text
   Question
    ↓
   User interaction
    ↓
   Answer
   ```

   编辑器不应强制使用与展示端完全相同的 UI。

   ------

   ## 十三、编辑器

   桌面端：

   ```text
   Markdown Editor | Live Preview
   ```

   移动端：

   ```text
   Edit | Preview
   ```

   Markdown 修改后应尽可能即时更新 Preview。

   ------

   ## 十四、长文本阅读

   卡片不自动分页。

   长内容采用连续滚动阅读：卡片高度由内容决定，页面自然滚动。

   不得对承载 Markdown 的容器设置 max-height + overflow: hidden。

   以下元素不得被裁切，必须完整可达：

   - Code Block
   - Table
   - Heading
   - Image
   - Math Block
   - Quote
   - List

   超出卡片宽度的元素（宽公式、宽表格、长代码块）应横向滚动，而不是被裁掉或缩放到无法阅读。

   ------

   ## 十五、搜索

   搜索数据来自：

   ```text
   index.json
   ```

   搜索至少支持：

   - title
   - tags
   - category
   - aliases
   - content
   - id

   搜索实现应优先保持纯前端。

   ------

   ## 十六、Index

   构建过程中生成：

   ```text
   index.json
   ```

   索引包含：

   - id
   - title
   - category
   - tags
   - status
   - difficulty
   - aliases
   - related
   - searchable text

   不应该为了搜索在运行时请求服务器。

   ------

   ## 十七、GitHub Pages

   部署流程：

   ```text
   git push
    ↓
   GitHub Actions
    ↓
   validate-content
    ↓
   build-index
    ↓
   vite build
    ↓
   GitHub Pages
   ```

   所有公开内容必须能够在没有后端服务器的情况下正常运行。

   ------

   ## 十八、PWA

   PWA 必须支持：

   - manifest
   - service worker
   - offline shell
   - standalone mode
   - app icon
   - responsive UI

   不得假设用户始终在线。

   ------

   ## 十九、Android

   Android 目标采用：

   ```text
   React
   +
   PWA
   +
   Capacitor
   ```

   不要为了 Android 单独重写 UI。

   ------

   ## 二十、导出

   导出引擎使用：

   ```text
   html2canvas
   ```

   支持：

   ```text
   PNG
   JPG
   WebP
   ```

   倍率：

   ```text
   1x
   2x
   3x
   4x
   ```

   SVG 导出应保持：

   ```text
   self-contained
   scalable
   ```

   ------

   ## 二十一、数据迁移

   必须保持 Markdown 数据可迁移。

   不得把核心知识内容锁定在：

   - 私有数据库
   - 二进制格式
   - 专有云服务

   未来应能够迁移到其他 Markdown 工具。

   ------

   ## 二十二、双向链接

   第一阶段暂不实现双向链接。

   可以支持：

   ```yaml
   related:
     - card-id
   ```

   但不要为了双向链接引入复杂数据库。

   未来可以增加：

   ```text
   [[card-id]]
   ```

   ------

   ## 二十三、不要过度工程化

   第一版本禁止为了“未来可能需要”而提前加入：

   - 用户系统
   - 权限系统
   - 云数据库
   - 多用户协作
   - 实时同步
   - WebSocket
   - 后端 API
   - AI API

   除非需求明确改变。

   ------

   ## 二十四、代码质量

   所有代码必须：

   - 使用 TypeScript
   - 尽量保持类型安全
   - 避免 any
   - 保持组件职责单一
   - 将业务逻辑与 UI 分离
   - 将 Markdown 解析逻辑与 Card UI 分离
   - 将 Theme Engine 与 Card Renderer 分离

   ------

   ## 二十五、修改现有功能

   修改功能时：

   1. 先理解现有架构
   2. 尽量复用现有组件
   3. 不随意改变数据格式
   4. 如果必须改变数据格式，应升级 schemaVersion
   5. 优先保持向后兼容
   6. 不要复制大量重复组件

   ------

   ## 二十六、增加主题

   增加主题时：

   1. 在 Theme Definition 中增加主题
   2. 定义 CSS Variables
   3. 添加主题预览
   4. 确认 Markdown 所有元素正常显示
   5. 确认代码块、表格、公式、引用正常
   6. 确认移动端正常

   不要复制 Card 组件。

   ------

   ## 二十七、增加知识内容

   新增知识卡片时：

   1. 创建 Markdown 文件
   2. 填写 Front Matter
   3. 设置唯一 ID
   4. 设置 category
   5. 设置 tags
   6. 设置 status
   7. 使用 Markdown 编写内容
   8. 执行内容校验
   9. 构建 index
   10. 确认页面正常

   ------

   ## 二十八、设计原则

   UI 应优先考虑：

   ```text
   内容可读性
   >
   信息层级
   >
   操作效率
   >
   视觉装饰
   ```

   主题可以高度艺术化，但不能影响知识内容阅读。

   ------

   ## 二十九、移动端优先事项

   移动端必须保证：

   - 卡片宽度自适应
   - Markdown 正常换行
   - 表格可横向滚动
   - 代码块可横向滚动
   - 数学公式不溢出
   - 图片自适应
   - 卡片翻面可操作
   - 导出按钮易于触摸
   - 编辑器可以使用

   ------

   ## 三十、最终架构原则

   整个项目始终保持：

   ```text
   Git
    │
    └── Markdown
          │
          ├── Metadata
          │
          └── Content
                 │
                 ▼
             Build Index
                 │
                 ▼
               React
                 │
          ┌──────┼──────┐
          ▼      ▼      ▼
        Search  Theme  Card
                        │
                 ┌──────┼──────┐
                 ▼      ▼      ▼
                Web     PWA   Export
   ```

   核心原则：

   > **数据属于 Markdown，版本属于 Git，索引属于构建系统，展示属于 React，视觉属于 Theme Engine。**
