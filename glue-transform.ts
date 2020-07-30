import { Transform } from 'assemblyscript/cli/transform'
import {
  Module,
  ExportsWalker,
  CommonFlags,
  TypeKind,
  SourceKind,
} from 'assemblyscript'
import {
  Program,
  Element,
  Global,
  Enum,
  Field,
  Function,
  Class,
  Interface,
} from 'assemblyscript/src/program'
import { Type } from 'assemblyscript/src/types'
import * as t from '@babel/types'
import generate from '@babel/generator'
import * as fs from 'fs'

const unchecked = function (p) {
  return p
}

const assert = function (p) {
  if (!p) throw 'assert fail: ' + p
  return p
}

class GlueTransform extends Transform {
  afterCompile(asModule: Module): void {
    try {
      GlueBuilder.build(this.program)
    } catch (e) {
      console.error(e)
    }
  }
}

const ASTHelper = {
  declare: (name, expression) => {
    return t.variableDeclaration('const', [
      t.variableDeclarator(t.identifier(name), expression),
    ])
  },
  call: (name, args) => {
    return t.callExpression(t.identifier(name), args)
  },
  dotCall: (obj, name, args) => {
    return t.callExpression(
      t.memberExpression(t.identifier(obj), t.identifier(name)),
      args
    )
  },
  declareFunction: (name, parameters) => {},
}

const a = ASTHelper

const isArrayType = (type) => /^Array/.test(type)
const isInternalType = (type) => /^~lib/.test(type)

const getInternalType = (type) => {
  return type.slice(type.lastIndexOf('/') + 1, -1)
}

const getArrayType = (type) => {
  const elementType = type.slice(6, -1)
  if (isInternalType(elementType)) {
    return getInternalType(elementType)
  } else if (isArrayType(elementType)) {
    return getArrayType(elementType)
  }
}

const getReferenceTypeHandler = (type) => {
  if (type === 'String') {
    return {
      allocateArgument: (arg, ref) => {
        const retain = a.call('__retain', [
          a.call('__allocString', [t.identifier(arg)]),
        ])
        if (ref) {
          return a.declare(ref, retain)
        }
        return retain
      },
      call: (fn, args, ref) => {
        return a.declare(
          ref,
          a.dotCall(
            'exports',
            fn,
            args.map((arg) => t.identifier(arg))
          )
        )
      },
      getValue: (ref, valueRef) => {
        return a.declare(valueRef, a.call('__getString', [t.identifier(ref)]))
      },
      release: (ref) => {
        if (ref) {
          return t.expressionStatement(a.call('__release', [t.identifier(ref)]))
        }
      },
    }
  } else if (/Array$/.test(type)) {
    return {
      allocateArgument: (arg, ref) => {
        const id = `${type}_ID`
        const idRef = t.memberExpression(
          t.identifier('exports'),
          t.identifier(id)
        )
        const retain = a.call('__retain', [
          a.call('__allocArray', [idRef, t.identifier(arg)]),
        ])
        if (ref) {
          return a.declare(ref, retain)
        }
        return retain
      },
      call: (fn, args, ref) => {
        return a.declare(
          ref,
          a.dotCall(
            'exports',
            fn,
            args.map((arg) => t.identifier(arg))
          )
        )
      },
      getValue: (ref, valueRef) => {
        return a.declare(valueRef, a.call('__getArray', [t.identifier(ref)]))
      },
      release: (ref) => {
        if (ref) {
          return t.expressionStatement(a.call('__release', [t.identifier(ref)]))
        }
      },
    }
  } else if (isArrayType(type)) {
    let arrayType = getArrayType(type)
    if (!arrayType) {
      throw `could not handle array type: ${type}`
    }
    return {
      allocateArgument: (arg, ref) => {
        const retain = a.dotCall(arg, 'map', [
          t.arrowFunctionExpression(
            [t.identifier('string')],
            getReferenceTypeHandler(arrayType).allocateArgument(arg)
          ),
        ])
        if (ref) {
          return a.declare(ref, retain)
        }
        return retain
      },
      release: (ref) => {
        if (ref) {
          return t.expressionStatement(a.call('__release', [t.identifier(ref)]))
        }
      },
    }
  } else {
    debugger
  }
}

class Composition {
  private name: string
  private parameters: any
  private returnType: any
  private returns: any[]
  private releases: any[]
  private calls: any[]
  private allocations: any[]
  private sections: {
    parameters: any[]
    returns: any[]
    releases: any[]
    calls: any[]
    allocations: any[]
  }

  constructor(name, parameters, returnType, opts = {}) {
    this.name = name
    this.parameters = parameters
    this.returnType = returnType
    // @ts-ignore
    this.sections = {}
    this.sections.allocations = []
    this.sections.calls = []
    this.sections.releases = []
    this.sections.returns = []
    this.sections.parameters = []
  }

  getFunctionName() {
    return this.name
  }

  getParameterName(i) {
    return this.parameters[i].name
  }

  getParameterPointerName(i) {
    return this.parameters[i].name + 'Ptr'
  }

  getParameterType(i) {
    return this.parameters[i].type
  }

  getReturnName() {
    return 'retValue'
  }

  getReturnPointerName() {
    return 'retPtr'
  }

  getReturnType() {
    return this.returnType
  }

  handleParameter(i) {
    const ptr = this.getParameterPointerName(i)
    const arg = this.getParameterName(i)
    const type = this.getParameterType(i)

    let alloc, release

    const handler = getReferenceTypeHandler(type)
    if (handler) {
      if (handler.allocateArgument) {
        alloc = handler.allocateArgument(arg, ptr)
        if (handler.release) {
          release = handler.release(ptr)
        }
      }
    } else {
      throw `could not handle parameter ${arg}:${type}`
    }

    this.sections.parameters.push(t.identifier(arg))
    this.sections.allocations.push(alloc)
    if (release) {
      this.sections.releases.push(release)
    }
  }

  handleCall() {
    const fn = this.getFunctionName()
    const ref = this.getReturnPointerName()
    const args = this.parameters.map((_, i) => this.getParameterPointerName(i))
    const type = this.getReturnType()

    let call

    const handler = getReferenceTypeHandler(type)
    if (handler) {
      if (handler.call) {
        call = handler.call(fn, args, ref)
      }
    } else {
      throw `could not handle call ${type}`
    }

    this.sections.allocations.push(call)
  }

  handleReturn() {
    const ref = this.getReturnPointerName()
    const type = this.getReturnType()
    const valueRef = this.getReturnName()

    let call, ret

    const handler = getReferenceTypeHandler(type)
    if (handler) {
      if (handler.getValue) {
        call = handler.getValue(ref, valueRef)
        ret = t.returnStatement(t.identifier(valueRef))
      }
    } else {
      throw `could not handle return ${type}`
    }

    this.sections.allocations.push(call)
    this.sections.returns.push(ret)
  }

  build() {
    this.parameters.forEach((_, i) => this.handleParameter(i))
    this.handleCall()
    this.handleReturn()

    const { allocations, calls, releases, parameters, returns } = this.sections

    const functionName = this.name
    const functionParams = parameters
    const functionBody = [...allocations, ...calls, ...releases, ...returns]

    return t.exportNamedDeclaration(
      t.functionDeclaration(
        t.identifier(functionName),
        functionParams,
        t.blockStatement(functionBody)
      )
    )
  }
}

const HEAD = `
let __allocString, __allocArray, __getString, __getArray, __retain, __release, exports

export default function(_exports) {
  __allocString = _exports.__allocString
  __allocArray = _exports.__allocArray
  __getString = _exports.__getString
  __getArray = _exports.__getArray
  __retain = _exports.__retain
  __release = _exports.__release
  exports = _exports
}
`

class GlueBuilder extends ExportsWalker {
  /** Builds TypeScript definitions for the specified program. */
  static build(program: Program): string {
    return new GlueBuilder(program).build()
  }

  private sb: string[] = []
  private ast: t.Statement[] = []
  private indentLevel: number = 0

  /** Constructs a new WebIDL builder. */
  constructor(program: Program, includePrivate: boolean = false) {
    super(program, includePrivate)
  }

  visitFunction(name: string, element: Function): void {
    if (element.isAny(CommonFlags.PRIVATE | CommonFlags.SET)) return
    if (element.isAny(CommonFlags.STATIC | CommonFlags.INSTANCE)) return

    const functionName = name
    var signature = element.signature

    var parameters = signature.parameterTypes

    const parametersData = parameters.map((p, i) => {
      const type = this.typeToString(p)
      const name = element.getParameterName(i)
      return {
        type,
        name,
      }
    })

    const c = new Composition(
      functionName,
      parametersData,
      this.typeToString(signature.returnType),
      {}
    )

    this.ast.push(c.build())
  }

  shortClassName(name): string {
    switch (name) {
      case 'string':
        return 'Str'
      default:
        return name
    }
  }

  typeToString(type: Type): string {
    switch (type.kind) {
      case TypeKind.I8:
        return 'i8'
      case TypeKind.I16:
        return 'i16'
      case TypeKind.I32:
        return 'i32'
      case TypeKind.I64:
        return 'i64'
      case TypeKind.ISIZE:
        return 'isize'
      case TypeKind.U8:
        return 'u8'
      case TypeKind.U16:
        return 'u16'
      case TypeKind.U32:
        return 'u32'
      // ^ TODO: function types
      case TypeKind.U64:
        return 'u64'
      case TypeKind.USIZE:
        if (type.classReference) {
          return type.classReference.name
        }
        return 'usize'
      // ^ TODO: class types
      case TypeKind.BOOL:
        return 'bool'
      case TypeKind.F32:
        return 'f32'
      case TypeKind.F64:
        return 'f64'
      case TypeKind.V128:
        return 'v128'
      case TypeKind.VOID:
        return 'void'
      default: {
        assert(false)
        return 'any'
      }
    }
  }

  /** Walks all elements and calls the respective handlers. */
  walk(): void {
    // TODO: for (let file of this.program.filesByName.values()) {
    for (
      let _values = Map_values(this.program.filesByName),
        i = 0,
        k = _values.length;
      i < k;
      ++i
    ) {
      let file = unchecked(_values[i])
      if (file.source.sourceKind == SourceKind.USER_ENTRY) {
        // When the runtime is "full", library files are included,
        // till I find a better way,
        // avoiding them by checking if they start with "~".
        if (!file.name.startsWith('~')) {
          this.visitFile(file)
        }
      }
    }
  }

  build(): string {
    this.walk()

    const code = generate(t.program(this.ast), {}).code

    console.log(code)

    const newCode = [HEAD.trim(), code].join('\n\n')

    fs.writeFileSync(__dirname + '/glue.js', newCode, 'utf8')

    return
  }

  visitAlias(name: string, element: Element, originalName: string): void {}

  visitClass(name: string, element: Class): void {}

  visitEnum(name: string, element: Enum): void {}

  visitField(name: string, element: Field): void {}

  visitGlobal(name: string, element: Global): void {}

  visitInterface(name: string, element: Interface): void {}

  visitNamespace(name: string, element: Element): void {}
}

export = GlueTransform
