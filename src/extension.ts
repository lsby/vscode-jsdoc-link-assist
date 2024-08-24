import path from 'path'
import * as vscode from 'vscode'
import {
  CodeAction,
  CodeActionProvider,
  CompletionItem,
  CompletionItemProvider,
  Position,
  Range,
  TextDocument,
  Uri,
  WorkspaceEdit,
} from 'vscode'
import { 获得所有补全项, 获得项目moduleResolution模式 } from './ast'

var 插件名称 = 'lsby-vscode-jsdoc-link-assist'

export function activate(context: vscode.ExtensionContext): void {
  console.log(`${插件名称}: 插件开始运行`)

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider('typescript', new 我的代码操作提供者(), {
      providedCodeActionKinds: 我的代码操作提供者.providedCodeActionKinds,
    }),
  )

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider('typescript', new 我的补全提供者(), '{', '@link '),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand(
      `${插件名称}.insertImport`,
      async (document: TextDocument, 补全项: { name: string; filePath: string; 相对路径: string }) => {
        var tsconfig文件路径 = await getTsConfigPath()
        if (!tsconfig文件路径) {
          await vscode.window.showInformationMessage(`没有找到tsconfig文件`)
          return
        }

        var 解析策略 = 获得项目moduleResolution模式(tsconfig文件路径)
        var 编辑行为 = 创建编辑行为(document, 补全项, 解析策略)
        await vscode.workspace.applyEdit(编辑行为)
      },
    ),
  )
}

class 我的代码操作提供者 implements CodeActionProvider {
  static providedCodeActionKinds = [vscode.CodeActionKind.QuickFix]

  async provideCodeActions(
    document: TextDocument,
    range: Range,
    _context: vscode.CodeActionContext,
    _token: vscode.CancellationToken,
  ): Promise<vscode.CodeAction[] | null | undefined> {
    if (!document.lineAt(range.start.line).text.includes(`{@link`)) return

    var 代码操作: CodeAction[] = []

    var 当前输入字段 = await 获得当前输入字段()
    if (!当前输入字段) return

    var tsconfig文件路径 = await getTsConfigPath()
    if (tsconfig文件路径 == null) {
      await vscode.window.showInformationMessage(`没有找到tsconfig文件`)
      return
    }

    var 编辑器 = vscode.window.activeTextEditor
    var 文件路径 = 编辑器?.document.uri.fsPath
    if (!文件路径) return

    var 补全项们 = 获得所有补全项(tsconfig文件路径, path.dirname(document.uri.fsPath), 文件路径)
    var 解析策略 = 获得项目moduleResolution模式(tsconfig文件路径)

    for (var 补全项 of 补全项们) {
      if (补全项.name.includes(当前输入字段)) {
        var 编辑行为 = 创建编辑行为(document, 补全项, 解析策略)
        var 行动 = new CodeAction(`导入 ${补全项.name} (${补全项.相对路径})`, vscode.CodeActionKind.QuickFix)
        行动.edit = 编辑行为
        代码操作.push(行动)
      }
    }

    return 代码操作
  }
}

class 我的补全提供者 implements CompletionItemProvider {
  async provideCompletionItems(
    document: TextDocument,
    position: Position,
    _token: vscode.CancellationToken,
    _context: vscode.CompletionContext,
  ): Promise<CompletionItem[] | null | undefined> {
    if (!document.lineAt(position.line).text.includes(`{@link`)) return

    var 当前输入字段 = await 获得当前输入字段()
    if (!当前输入字段) return

    var tsconfig文件路径 = await getTsConfigPath()
    if (tsconfig文件路径 == null) {
      await vscode.window.showInformationMessage(`没有找到tsconfig文件`)
      return null
    }

    var 编辑器 = vscode.window.activeTextEditor
    var 文件路径 = 编辑器?.document.uri.fsPath
    if (!文件路径) return

    var 补全项们 = 获得所有补全项(tsconfig文件路径, path.dirname(document.uri.fsPath), 文件路径)

    var completionItems: CompletionItem[] = []
    for (var 补全项 of 补全项们) {
      if (补全项.name.includes(当前输入字段)) {
        var completionItem = new CompletionItem(补全项.name, vscode.CompletionItemKind.Function)
        completionItem.detail = `来自 ${补全项.filePath}`
        completionItem.command = {
          title: `导入 ${补全项.name}`,
          command: `${插件名称}.insertImport`,
          arguments: [document, 补全项],
        }
        completionItems.push(completionItem)
      }
    }

    return completionItems
  }
}

export function deactivate(): void {}

function 创建编辑行为(
  document: TextDocument,
  补全项: { name: string; filePath: string; 相对路径: string },
  解析策略: string | null,
): vscode.WorkspaceEdit {
  var 替换字符 = 解析策略 == 'NodeNext' ? '.js' : ''
  var 导入语句 = `import { ${补全项.name} } from '${补全项.相对路径.replace(/\.ts$/, 替换字符)}';\n`

  var edit = new WorkspaceEdit()

  var 编辑器 = vscode.window.activeTextEditor
  var 文件路径 = 编辑器?.document.uri.fsPath
  if (!文件路径) return edit

  var 标准化当前文件路径 = path.resolve(文件路径)
  var 标准化导入文件路径 = path.resolve(补全项.filePath)

  var 范围 = 获得光标词范围()
  if (范围 != null) edit.replace(document.uri, 范围, 补全项.name)

  var 全文 = document.getText().replace(/;/, '').replace(/\r\n/, '\n').replace(/\r/, '\n')
  var 导入 = 导入语句.replace(/;/, '').replace(/\r\n/, '\n').replace(/\r/, '\n')
  if (!全文.includes(导入) && 标准化当前文件路径 != 标准化导入文件路径) {
    edit.insert(document.uri, new Position(0, 0), 导入语句)
  }

  return edit
}

function 获得编辑器文件和位置(): { 文件: vscode.TextDocument; 位置: vscode.Position } | null {
  var 编辑器 = vscode.window.activeTextEditor
  if (!编辑器) return null

  var 编辑器选择 = 编辑器.selections[0]
  if (!编辑器选择) return null

  var 位置 = 编辑器选择.anchor
  var 文件 = 编辑器.document

  return { 文件, 位置 }
}

function 获得光标词范围(): vscode.Range | null {
  var 文件和位置 = 获得编辑器文件和位置()
  if (文件和位置 == null) return null

  var 范围 = 文件和位置.文件.getWordRangeAtPosition(文件和位置.位置)
  if (范围 == null) return null

  return 范围
}

function 获得当前输入字段(): Promise<string> {
  return new Promise((res, _rej) => {
    setTimeout(() => {
      var 范围 = 获得光标词范围()
      if (范围 == null) return ''

      var 文件和位置 = 获得编辑器文件和位置()
      if (文件和位置 == null) return ''

      var 当前输入字段 = 文件和位置.文件.getText(范围)
      return res(当前输入字段)
    }, 0)
  })
}

async function getTsConfigPath(): Promise<string | null> {
  var files: Uri[] = await vscode.workspace.findFiles('**/tsconfig.json', '**/node_modules/**', 1)

  var 文件 = files[0]
  if (文件) {
    return 文件.fsPath
  }

  return null
}
