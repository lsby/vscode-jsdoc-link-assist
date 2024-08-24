import * as path from 'path'
import ts from 'typescript'

function 获得所有函数(
  filePath: string,
  sourceFile: ts.SourceFile,
  isExport: boolean = true,
): { name: string; filePath: string }[] {
  const 函数们: { name: string; filePath: string }[] = []
  const 访问函数 = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name) {
      if ((isExport && node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) || !isExport)
        函数们.push({ name: node.name.text, filePath })
    }
    ts.forEachChild(node, 访问函数)
  }
  访问函数(sourceFile)
  return 函数们
}

export function 获得所有补全项(
  tsconfig路径: string,
  根路径: string,
  当前所在文件: string,
): { name: string; filePath: string; 相对路径: string }[] {
  const 配置 = ts.readConfigFile(tsconfig路径, ts.sys.readFile)
  const 解析 = ts.parseJsonConfigFileContent(配置.config, ts.sys, path.dirname(tsconfig路径))

  const 程序 = ts.createProgram(解析.fileNames, 解析.options)
  const 函数们: { name: string; filePath: string; 相对路径: string }[] = []

  const 标准化当前所在文件路径 = path.resolve(当前所在文件)
  for (const 文件 of 程序.getSourceFiles()) {
    if (!文件.isDeclarationFile) {
      const 文件路径 = 文件.fileName
      var 标准化文件路径 = path.resolve(文件路径)

      var 函数结果们: { name: string; filePath: string }[] = []
      if (标准化当前所在文件路径 == 标准化文件路径) {
        函数结果们 = 获得所有函数(文件路径, 文件, false)
      } else {
        函数结果们 = 获得所有函数(文件路径, 文件, true)
      }
      函数们.push(
        ...函数结果们.map((a) => ({
          ...a,
          相对路径: './' + path.relative(根路径, a.filePath).replace(/\\/g, '/'),
        })),
      )
    }
  }

  return 函数们
}

export function 获得项目moduleResolution模式(tsconfig路径: string): string | null {
  const 配置 = ts.readConfigFile(tsconfig路径, ts.sys.readFile)
  if (配置.error) throw new Error(`Error reading tsconfig.json: ${配置.error.messageText}`)
  const 解析 = ts.parseJsonConfigFileContent(配置.config, ts.sys, path.dirname(tsconfig路径))
  const mr模式 = 解析.options.moduleResolution ? ts.ModuleResolutionKind[解析.options.moduleResolution] : null
  return mr模式
}
