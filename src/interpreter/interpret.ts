import type {
  ClassBody,
  Expression,
  AnyNode,
  ModuleDeclaration,
  Pattern,
  Statement,
  VariableDeclaration,
} from 'acorn'
import type { VizEvent } from '../bridge/events'
import { arrayMember, createGlobals, stringMember } from './builtins'
import { NoracursionError, runtimeError, type TestVariable } from './errors'
import { walk } from './ast'
import { endPositionOf, parse, positionOf, type ParsedProgram, type Position } from './parse'
import { Env } from './scope'
import { rejectUnsupported as reject, validateSubset } from './validate'
import {
  capture,
  formatSnapshot,
  isCallable,
  isClassValue,
  isValueObject,
  stringify,
  truthy,
  typeName,
  type ClassValue,
  type FunctionNode,
  type NativeContext,
  type RunSummary,
  type Snapshot,
  type Step,
  type StepPhase,
  type UserFunction,
  type Value,
} from './values'

export interface RunOptions {
  /** Total steps for the whole run. CLAUDE.md §3.3 default. */
  readonly stepBudget?: number
  /** Iterations allowed for any single loop. */
  readonly maxLoopIterations?: number
  /** Recursion depth before a `recursion-depth` error. */
  readonly maxCallDepth?: number
  /**
   * Values injected into the interpreted program's global scope — the live
   * structure and the instrumentation helpers the bridge supplies (§3.4).
   */
  readonly globals?: ReadonlyMap<string, Value>
}

const DEFAULT_STEP_BUDGET = 10_000
const DEFAULT_MAX_LOOP_ITERATIONS = 1_000
const DEFAULT_MAX_CALL_DEPTH = 200

// --- internal control flow -------------------------------------------------
// `break` / `continue` / `return` unwind through generator frames, and the only
// mechanism that does that is a throw. This is internal: `try` / `catch` is not
// in the v1 subset, so interpreted code can neither see nor intercept these.

class BreakSignal {}
class ContinueSignal {}
class ReturnSignal {
  constructor(readonly value: Value) {}
}

class Interpreter {
  private readonly stepBudget: number
  private readonly maxLoopIterations: number
  private readonly maxCallDepth: number
  private readonly parsed: ParsedProgram
  private readonly globalEnv: Env

  private steps = 0
  private callDepth = 0
  private readonly stack: string[] = []
  private pendingEvents: VizEvent[] = []
  private readonly logs: string[] = []

  constructor(parsed: ParsedProgram, options: RunOptions) {
    this.parsed = parsed
    this.stepBudget = options.stepBudget ?? DEFAULT_STEP_BUDGET
    this.maxLoopIterations = options.maxLoopIterations ?? DEFAULT_MAX_LOOP_ITERATIONS
    this.maxCallDepth = options.maxCallDepth ?? DEFAULT_MAX_CALL_DEPTH

    this.globalEnv = Env.global()
    for (const [name, value] of createGlobals((text) => this.logs.push(text))) {
      this.globalEnv.declare(name, 'const', value)
    }
    // Injected last so a host handle wins over a builtin of the same name.
    for (const [name, value] of options.globals ?? []) {
      this.globalEnv.declare(name, 'const', value)
    }
  }

  *run(): Generator<Step, RunSummary, void> {
    const env = this.globalEnv.child(true)
    try {
      yield* this.execBody(this.parsed.program.body, env)
    } catch (error) {
      // `return` at the top level: end the run rather than blow up.
      if (!(error instanceof ReturnSignal)) throw error
    }
    // Anchored on the last statement, not on the Program node: a program's end
    // position sits past the final newline, which would report a line that has
    // no code on it.
    const body = this.parsed.program.body
    const anchor = body.length === 0 ? this.parsed.program : body[body.length - 1]
    yield* this.emit(this.parsed.program, 'program-exit', env, endPositionOf(anchor))
    return this.summary(true)
  }

  private summary(completed: boolean): RunSummary {
    return { steps: this.steps, completed, logs: [...this.logs] }
  }

  // --- stepping ------------------------------------------------------------

  /**
   * The single place a `Step` is produced, so the step budget cannot be
   * bypassed. CLAUDE.md §3.3 puts both budgets on the host; this one lives in
   * the generator instead, because the guarantee that the tab cannot hang
   * should not depend on every host remembering to count.
   */
  private *emit(
    node: AnyNode,
    phase: StepPhase,
    env: Env,
    position: Position = positionOf(node),
  ): Generator<Step, void, void> {
    const { line, column } = position
    this.steps += 1
    if (this.steps > this.stepBudget) {
      throw new NoracursionError(
        `This program ran ${this.stepBudget} steps without finishing.`,
        { kind: 'step-budget', steps: this.stepBudget, line },
        `Execution stopped at line ${line}. Either the program needs more than ${this.stepBudget} steps — raise \`stepBudget\` — or something is repeating that should not be.`,
      )
    }
    const events = this.pendingEvents
    this.pendingEvents = []
    yield {
      line,
      column,
      nodeType: node.type,
      phase,
      scope: env.snapshot(),
      callDepth: this.callDepth,
      callStack: [...this.stack],
      events,
    }
  }

  private fail(node: AnyNode, message: string, hint: string): never {
    const { line, column } = positionOf(node)
    throw runtimeError(message, line, column, hint)
  }

  /**
   * Run host code and give whatever it throws a line number.
   *
   * A handle from `bridge/` raises a plain `RangeError` when an index is out of
   * bounds. Left alone that surfaces as an unpositioned stack trace, which is
   * the one thing §3.3 forbids; this turns it into an ordinary runtime error
   * pointing at the line that did it.
   */
  private guard<T>(node: AnyNode, body: () => T): T {
    try {
      return body()
    } catch (error) {
      if (error instanceof NoracursionError) throw error
      const message = error instanceof Error ? error.message : String(error)
      this.fail(node, message, `Check the values used on line ${positionOf(node).line}.`)
    }
  }

  // --- statements ----------------------------------------------------------

  private *execBody(
    body: ReadonlyArray<Statement | ModuleDeclaration>,
    env: Env,
  ): Generator<Step, void, void> {
    // `import` / `export` parse (the source is treated as a module so it is in
    // strict mode) but have nowhere to resolve to, so name them and stop.
    const statements: Statement[] = []
    for (const node of body) {
      if (isModuleDeclaration(node)) reject(node)
      statements.push(node)
    }

    hoistVars(statements, env)
    // Function declarations hoist; classes do not, which is what JS does and
    // what a learner stepping through the code will expect to see.
    for (const statement of statements) {
      if (statement.type === 'FunctionDeclaration') {
        env.declare(statement.id.name, 'var', this.makeFunction(statement, env, statement.id.name))
      }
    }
    for (const statement of statements) {
      yield* this.execStatement(statement, env)
    }
  }

  private *execStatement(node: Statement, env: Env): Generator<Step, void, void> {
    // A block and an empty statement are punctuation, not actions: stepping
    // onto `{` would highlight a line where nothing happens. Every other
    // statement yields before it runs (§3.2).
    if (node.type !== 'BlockStatement' && node.type !== 'EmptyStatement') {
      yield* this.emit(node, 'statement', env)
    }

    switch (node.type) {
      case 'EmptyStatement':
        return

      case 'BlockStatement':
        yield* this.execBody(node.body, env.child())
        return

      case 'ExpressionStatement':
        yield* this.evaluate(node.expression, env)
        return

      case 'VariableDeclaration':
        yield* this.execVariableDeclaration(node, env)
        return

      case 'FunctionDeclaration':
        // Already hoisted by execBody; reaching it is a no-op.
        return

      case 'ClassDeclaration': {
        if (node.id === null) reject(node)
        env.declare(node.id.name, 'let', this.makeClass(node.id.name, node.body, env))
        return
      }

      case 'IfStatement': {
        const test = yield* this.evaluate(node.test, env)
        if (truthy(test)) {
          yield* this.execStatement(node.consequent, env)
        } else if (node.alternate !== null && node.alternate !== undefined) {
          yield* this.execStatement(node.alternate, env)
        }
        return
      }

      case 'WhileStatement': {
        const loop = new LoopWatch(node, node.test, this.maxLoopIterations)
        for (;;) {
          yield* this.emit(node.test, 'loop-test', env)
          const test = yield* this.evaluate(node.test, env)
          loop.record(env)
          if (!truthy(test)) return
          loop.tick(env, this.parsed)
          if (yield* this.runLoopBody(node.body, env)) return
        }
      }

      case 'DoWhileStatement': {
        const loop = new LoopWatch(node, node.test, this.maxLoopIterations)
        for (;;) {
          loop.tick(env, this.parsed)
          if (yield* this.runLoopBody(node.body, env)) return
          yield* this.emit(node.test, 'loop-test', env)
          const test = yield* this.evaluate(node.test, env)
          loop.record(env)
          if (!truthy(test)) return
        }
      }

      case 'ForStatement': {
        const scope = env.child()
        // `for (let i = …)` gives every iteration its *own* `i`, so a closure
        // made inside the body captures that iteration's value rather than
        // whatever the counter finished on. `var` does not — one binding for
        // the whole loop — and getting this wrong turns the single most
        // commonly taught closure lesson into a lie.
        let perIteration: string[] = []
        if (node.init !== null && node.init !== undefined) {
          if (node.init.type === 'VariableDeclaration') {
            yield* this.execVariableDeclaration(node.init, scope)
            if (node.init.kind !== 'var') perIteration = declaredNames(node.init)
          } else {
            yield* this.evaluate(node.init, scope)
          }
        }
        const testNode = node.test ?? null
        const loop = new LoopWatch(node, testNode, this.maxLoopIterations)
        for (;;) {
          if (testNode !== null) {
            yield* this.emit(testNode, 'loop-test', scope)
            const test = yield* this.evaluate(testNode, scope)
            loop.record(scope)
            if (!truthy(test)) return
          } else {
            loop.record(scope)
          }
          loop.tick(scope, this.parsed)

          // A fresh copy of the loop variables for this turn round. The body
          // runs against those; the update runs against the shared ones, so
          // the copy the body closed over keeps the value it had.
          const iteration = copyBindings(scope, perIteration)
          const broke = yield* this.runLoopBody(node.body, iteration)
          writeBack(iteration, scope, perIteration)
          if (broke) return

          if (node.update !== null && node.update !== undefined) {
            yield* this.evaluate(node.update, scope)
          }
        }
      }

      case 'ForOfStatement': {
        const iterable = yield* this.evaluate(node.right, env)
        const items = this.iterableToArray(iterable, node.right)
        const loop = new LoopWatch(node, node.right, this.maxLoopIterations)
        for (const item of items) {
          const scope = env.child()
          yield* this.emit(node, 'loop-test', scope)
          loop.record(scope)
          loop.tick(scope, this.parsed)
          if (node.left.type === 'VariableDeclaration') {
            const declarator = node.left.declarations[0]
            this.bindPattern(declarator.id, item, scope, kindOf(node.left))
          } else if (node.left.type === 'Identifier') {
            yield* this.assignToTarget(node.left, item, scope)
          } else {
            reject(node.left)
          }
          if (yield* this.runLoopBody(node.body, scope)) return
        }
        return
      }

      case 'BreakStatement':
        if (node.label !== null && node.label !== undefined) reject(node)
        throw new BreakSignal()

      case 'ContinueStatement':
        if (node.label !== null && node.label !== undefined) reject(node)
        throw new ContinueSignal()

      case 'ReturnStatement': {
        const value =
          node.argument === null || node.argument === undefined
            ? undefined
            : yield* this.evaluate(node.argument, env)
        throw new ReturnSignal(value)
      }

      default:
        reject(node)
    }
  }

  /** Runs a loop body, translating `break` into "stop" and `continue` into "go on". */
  private *runLoopBody(body: Statement, env: Env): Generator<Step, boolean, void> {
    try {
      yield* this.execStatement(body, env.child())
    } catch (error) {
      if (error instanceof BreakSignal) return true
      if (error instanceof ContinueSignal) return false
      throw error
    }
    return false
  }

  private *execVariableDeclaration(
    node: VariableDeclaration,
    env: Env,
  ): Generator<Step, void, void> {
    const kind = kindOf(node)
    for (const declarator of node.declarations) {
      const value =
        declarator.init === null || declarator.init === undefined
          ? undefined
          : yield* this.evaluate(declarator.init, env)
      if (kind === 'const' && declarator.init === null) {
        this.fail(
          declarator,
          'A `const` has to be given a value where it is declared.',
          'Either give it a value here, or declare it with `let` if it gets one later.',
        )
      }
      this.bindPattern(declarator.id, value, env, kind)
    }
  }

  // --- patterns ------------------------------------------------------------

  private bindPattern(
    pattern: Pattern,
    value: Value,
    env: Env,
    kind: 'let' | 'const' | 'var' | 'param',
  ): void {
    switch (pattern.type) {
      case 'Identifier':
        env.declare(pattern.name, kind, value)
        return

      case 'ArrayPattern': {
        if (!Array.isArray(value)) {
          this.fail(
            pattern,
            `Cannot unpack ${typeName(value)} with an array pattern.`,
            'The value on the right of `=` has to be an array to destructure it like this.',
          )
        }
        pattern.elements.forEach((element, index) => {
          if (element === null || element === undefined) return
          if (element.type !== 'Identifier') reject(element)
          this.bindPattern(element, value[index], env, kind)
        })
        return
      }

      case 'ObjectPattern': {
        for (const property of pattern.properties) {
          if (property.type !== 'Property') reject(property)
          if (property.computed || property.key.type !== 'Identifier') reject(property)
          if (property.value.type !== 'Identifier') reject(property.value)
          const name = property.key.name
          this.bindPattern(property.value, this.readProperty(value, name, pattern), env, kind)
        }
        return
      }

      default:
        reject(pattern)
    }
  }

  // --- expressions ---------------------------------------------------------

  private *evaluate(node: Expression, env: Env): Generator<Step, Value, void> {
    switch (node.type) {
      case 'Literal': {
        const { value } = node
        // acorn reports both `null` and an absent value as `null`, so the raw
        // text is what tells them apart.
        if (value === null) return node.raw === 'null' ? null : undefined
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          return value
        }
        // Regex and BigInt literals are turned away by `validateSubset` before
        // the program starts; this is the unreachable remainder.
        return reject(node)
      }

      case 'Identifier': {
        if (node.name === 'undefined') return undefined
        const binding = env.lookup(node.name)
        if (binding === undefined) {
          this.fail(
            node,
            `\`${node.name}\` is not defined.`,
            `Declare it before line ${positionOf(node).line} with \`let ${node.name} = …\`, or check the spelling.`,
          )
        }
        return binding.value
      }

      case 'ThisExpression': {
        const binding = env.lookup('this')
        if (binding === undefined) {
          this.fail(
            node,
            '`this` is only available inside a class method.',
            'Outside a method, use the variable directly instead of `this`.',
          )
        }
        return binding.value
      }

      case 'TemplateLiteral': {
        let result = ''
        for (let index = 0; index < node.quasis.length; index += 1) {
          result += node.quasis[index].value.cooked ?? node.quasis[index].value.raw
          if (index < node.expressions.length) {
            result += stringify(yield* this.evaluate(node.expressions[index], env))
          }
        }
        return result
      }

      case 'ArrayExpression': {
        const items: Value[] = []
        for (const element of node.elements) {
          if (element === null || element === undefined) {
            items.push(undefined)
            continue
          }
          if (element.type === 'SpreadElement') reject(element)
          items.push(yield* this.evaluate(element, env))
        }
        return items
      }

      case 'ObjectExpression': {
        const properties = new Map<string, Value>()
        for (const property of node.properties) {
          if (property.type !== 'Property') reject(property)
          const key = property.computed
            ? propertyKeyOf(yield* this.evaluate(keyExpression(property.key, reject), env))
            : staticKey(property.key, reject)
          properties.set(
            String(key),
            yield* this.evaluate(valueExpression(property.value, reject), env),
          )
        }
        return { type: 'object', classRef: null, properties }
      }

      case 'MemberExpression': {
        const object = yield* this.evaluate(objectExpression(node.object, reject), env)
        const key = yield* this.memberKey(node.computed, node.property, env)
        return this.readProperty(object, key, node)
      }

      case 'UnaryExpression': {
        const argument = yield* this.evaluate(node.argument, env)
        switch (node.operator) {
          case '!':
            return !truthy(argument)
          case '-':
            return -this.requireNumber(argument, node, 'negate')
          case '+':
            return this.requireNumber(argument, node, 'apply unary `+` to')
          case 'typeof':
            return typeofValue(argument)
          case 'void':
            return undefined
          default:
            reject(node)
        }
        break
      }

      case 'UpdateExpression':
        return yield* this.evalUpdate(node.operator, node.prefix, node.argument, node, env)

      case 'BinaryExpression': {
        const left = yield* this.evaluate(leftExpression(node.left, reject), env)
        const right = yield* this.evaluate(node.right, env)
        return this.binary(node.operator, left, right, node)
      }

      case 'LogicalExpression': {
        const left = yield* this.evaluate(node.left, env)
        if (node.operator === '&&')
          return truthy(left) ? yield* this.evaluate(node.right, env) : left
        if (node.operator === '||')
          return truthy(left) ? left : yield* this.evaluate(node.right, env)
        // `??`
        return left === null || left === undefined ? yield* this.evaluate(node.right, env) : left
      }

      case 'ConditionalExpression': {
        const test = yield* this.evaluate(node.test, env)
        return truthy(test)
          ? yield* this.evaluate(node.consequent, env)
          : yield* this.evaluate(node.alternate, env)
      }

      case 'AssignmentExpression': {
        const target = node.left
        if (node.operator === '=') {
          const value = yield* this.evaluate(node.right, env)
          yield* this.assignToTarget(target, value, env)
          return value
        }
        const operator = node.operator.slice(0, -1)
        if (target.type !== 'Identifier' && target.type !== 'MemberExpression') reject(target)
        const current = yield* this.evaluate(target, env)
        const right = yield* this.evaluate(node.right, env)
        const value = this.binary(operator, current, right, node)
        yield* this.assignToTarget(target, value, env)
        return value
      }

      case 'CallExpression':
        return yield* this.evalCall(node.callee, node.arguments, node, env)

      case 'NewExpression': {
        const callee = yield* this.evaluate(objectExpression(node.callee, reject), env)
        if (!isClassValue(callee)) {
          this.fail(
            node,
            `\`new\` needs a class, but got ${typeName(callee)}.`,
            'Only classes declared in this snippet can be constructed with `new`.',
          )
        }
        const args: Value[] = []
        for (const argument of node.arguments) {
          if (argument.type === 'SpreadElement') reject(argument)
          args.push(yield* this.evaluate(argument, env))
        }
        return yield* this.construct(callee, args, node)
      }

      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        return this.makeFunction(node, env, node.type === 'FunctionExpression' ? nameOf(node) : '')

      case 'ClassExpression': {
        const name = node.id === null || node.id === undefined ? '' : node.id.name
        return this.makeClass(name, node.body, env)
      }

      default:
        reject(node)
    }
  }

  private *memberKey(
    computed: boolean,
    property: AnyNode,
    env: Env,
  ): Generator<Step, string | number, void> {
    if (computed) {
      return propertyKeyOf(yield* this.evaluate(keyExpression(property, reject), env))
    }
    return staticKey(property, reject)
  }

  private *evalUpdate(
    operator: string,
    prefix: boolean,
    target: AnyNode,
    node: AnyNode,
    env: Env,
  ): Generator<Step, Value, void> {
    if (target.type !== 'Identifier' && target.type !== 'MemberExpression') reject(target)
    const current = yield* this.evaluate(targetExpression(target, reject), env)
    const before = this.requireNumber(current, node, operator === '++' ? 'increment' : 'decrement')
    const after = operator === '++' ? before + 1 : before - 1
    yield* this.assignToTarget(targetExpression(target, reject), after, env)
    return prefix ? after : before
  }

  private *assignToTarget(target: AnyNode, value: Value, env: Env): Generator<Step, void, void> {
    if (target.type === 'Identifier') {
      const binding = env.lookup(target.name)
      if (binding === undefined) {
        this.fail(
          target,
          `\`${target.name}\` is not defined.`,
          `Declare it first with \`let ${target.name} = …\` — assigning to an undeclared name does not create it here.`,
        )
      }
      if (binding.kind === 'const') {
        this.fail(
          target,
          `\`${target.name}\` is declared with \`const\`, so it cannot be reassigned.`,
          `Declare it with \`let\` instead if it needs to change.`,
        )
      }
      binding.value = value
      return
    }

    if (target.type === 'MemberExpression') {
      const object = yield* this.evaluate(objectExpression(target.object, reject), env)
      const key = yield* this.memberKey(target.computed, target.property, env)
      this.writeProperty(object, key, value, target)
      return
    }

    reject(target)
  }

  private *evalCall(
    callee: AnyNode,
    argumentNodes: readonly AnyNode[],
    node: AnyNode,
    env: Env,
  ): Generator<Step, Value, void> {
    const target = yield* this.evaluate(targetExpression(callee, reject), env)
    const args: Value[] = []
    for (const argument of argumentNodes) {
      if (argument.type === 'SpreadElement') reject(argument)
      args.push(yield* this.evaluate(keyExpression(argument, reject), env))
    }
    if (!isCallable(target)) {
      const name = callee.type === 'Identifier' ? `\`${callee.name}\`` : 'That value'
      this.fail(
        node,
        `${name} is not a function — it is ${typeName(target)}.`,
        callee.type === 'MemberExpression'
          ? 'Check the property name; only the methods listed in the docs are available here.'
          : 'Check the spelling, or declare the function before calling it.',
      )
    }
    return yield* this.callValue(target, args, node)
  }

  private *callValue(callee: Value, args: Value[], node: AnyNode): Generator<Step, Value, void> {
    if (!isCallable(callee)) {
      this.fail(
        node,
        `That value is not a function — it is ${typeName(callee)}.`,
        'Only functions can be called.',
      )
    }
    if (callee.type === 'native') {
      return this.guard(node, () => callee.call(args, this.nativeContext(node)))
    }
    if (callee.type === 'native-generator') {
      return yield* callee.call(args, this.nativeContext(node))
    }
    return yield* this.callUserFunction(callee, args, node)
  }

  private nativeContext(node: AnyNode): NativeContext {
    return {
      callValue: (callee, args) => this.callValue(callee, args, node),
      fail: (message, hint) => this.fail(node, message, hint),
      emit: (event) => this.pendingEvents.push(event),
    }
  }

  private *callUserFunction(
    fn: UserFunction,
    args: Value[],
    callSite: AnyNode,
  ): Generator<Step, Value, void> {
    if (this.callDepth + 1 > this.maxCallDepth) {
      const name = fn.name === '' ? 'this function' : `\`${fn.name}\``
      const firstParam =
        fn.params.length > 0 && fn.params[0].type === 'Identifier' ? fn.params[0].name : null
      const baseCase =
        firstParam === null
          ? 'a condition near the top that returns without calling it again'
          : `a check near the top like \`if (${firstParam} === null) return …\` that returns without calling it again`
      throw new NoracursionError(
        `${fn.name === '' ? 'A function' : `\`${fn.name}\``} called itself ${this.maxCallDepth} times without stopping.`,
        {
          kind: 'recursion-depth',
          functionName: fn.name,
          line: positionOf(callSite).line,
          depth: this.maxCallDepth,
        },
        `Every recursive function needs a base case — ${baseCase}. Right now ${name} always recurses, so it never gets back out.`,
      )
    }

    const scope = fn.closure.child(true)
    if (fn.thisValue !== undefined) scope.declare('this', 'this', fn.thisValue)
    fn.params.forEach((param, index) => {
      this.bindPattern(param, args[index], scope, 'param')
    })

    this.callDepth += 1
    this.stack.push(fn.name === '' ? '(anonymous)' : fn.name)
    try {
      yield* this.emit(fn.node, 'function-entry', scope)
      const body = fn.node.body
      if (body.type === 'BlockStatement') {
        try {
          yield* this.execBody(body.body, scope)
        } catch (error) {
          if (error instanceof ReturnSignal) {
            yield* this.emit(fn.node, 'function-exit', scope)
            return error.value
          }
          throw error
        }
        yield* this.emit(fn.node, 'function-exit', scope)
        return undefined
      }
      // Concise arrow body: `(x) => x + 1`
      const value = yield* this.evaluate(body, scope)
      yield* this.emit(fn.node, 'function-exit', scope)
      return value
    } finally {
      this.callDepth -= 1
      this.stack.pop()
    }
  }

  private *construct(
    classValue: ClassValue,
    args: Value[],
    node: AnyNode,
  ): Generator<Step, Value, void> {
    const instance: Value = {
      type: 'object',
      classRef: classValue,
      properties: new Map<string, Value>(),
    }
    if (classValue.constructorFn !== null) {
      const bound: UserFunction = { ...classValue.constructorFn, thisValue: instance }
      yield* this.callUserFunction(bound, args, node)
    }
    return instance
  }

  // --- values --------------------------------------------------------------

  private makeFunction(node: FunctionNode, env: Env, name: string): UserFunction {
    const params: Pattern[] = []
    for (const param of node.params) {
      if (param.type === 'RestElement' || param.type === 'AssignmentPattern') reject(param)
      params.push(param)
    }
    // An arrow captures the `this` of where it was written; a plain function
    // does not get one, because `this` outside a class method is out of subset.
    const inherited = node.type === 'ArrowFunctionExpression' ? env.lookup('this') : undefined
    return {
      type: 'function',
      name,
      node,
      params,
      closure: env,
      thisValue: inherited === undefined ? undefined : inherited.value,
    }
  }

  private makeClass(name: string, body: ClassBody, env: Env): ClassValue {
    const methods = new Map<string, UserFunction>()
    let constructorFn: UserFunction | null = null

    for (const member of body.body) {
      if (member.type !== 'MethodDefinition') reject(member)
      if (member.static) reject(member)
      if (member.computed || member.key.type !== 'Identifier') reject(member.key)
      const methodName = member.key.name
      // `this` is bound per instance at call time; a placeholder here would be
      // captured by every instance at once.
      const fn = this.makeFunction(member.value, env, methodName)
      if (member.kind === 'constructor') constructorFn = fn
      else if (member.kind === 'method') methods.set(methodName, fn)
      else reject(member)
    }

    return { type: 'class', name, constructorFn, methods }
  }

  private readProperty(object: Value, key: string | number, node: AnyNode): Value {
    if (object === null || object === undefined) {
      this.fail(
        node,
        `Cannot read \`${key}\` of ${object === null ? 'null' : 'undefined'}.`,
        `Something on line ${positionOf(node).line} is ${object === null ? 'null' : 'undefined'} when the code expects an object. Check for that case before this line — e.g. \`if (x === null) return\`.`,
      )
    }

    if (Array.isArray(object)) {
      if (typeof key === 'number') return object[key]
      const member = arrayMember(object, key)
      if (member === undefined) {
        this.fail(
          node,
          `Arrays here do not have a \`${key}\` method.`,
          'Supported array methods are push, pop, shift, unshift, slice, concat, indexOf, includes, join, reverse, map, filter, forEach, reduce and sort, plus `length`.',
        )
      }
      return member
    }

    if (typeof object === 'string') {
      if (typeof key === 'number') return object[key]
      const member = stringMember(object, key)
      if (member === undefined) {
        this.fail(
          node,
          `Strings here do not have a \`${key}\` property.`,
          'Only `length` is available on strings in this subset.',
        )
      }
      return member
    }

    if (typeof object === 'number' || typeof object === 'boolean') {
      this.fail(
        node,
        `Cannot read \`${key}\` of ${typeName(object)}.`,
        'Numbers and booleans have no properties in this subset.',
      )
    }

    if (isValueObject(object)) {
      const indexed = object.indexed
      if (indexed !== undefined) {
        if (typeof key === 'number') return this.guard(node, () => indexed.get(key))
        if (key === 'length') return this.guard(node, () => indexed.length())
      }
      const name = String(key)
      const own = object.properties.get(name)
      if (own !== undefined || object.properties.has(name)) return own
      if (object.classRef !== null) {
        const method = object.classRef.methods.get(name)
        // Bind `this` at lookup so `instance.method()` and a detached
        // reference to it behave the same way.
        if (method !== undefined) return { ...method, thisValue: object }
      }
      return undefined
    }

    // Functions and classes: no properties in this subset.
    this.fail(
      node,
      `Cannot read \`${key}\` of ${typeName(object)}.`,
      'Functions and classes have no properties in this subset.',
    )
  }

  private writeProperty(object: Value, key: string | number, value: Value, node: AnyNode): void {
    if (object === null || object === undefined) {
      this.fail(
        node,
        `Cannot set \`${key}\` on ${object === null ? 'null' : 'undefined'}.`,
        'Check that the object exists before assigning to one of its properties.',
      )
    }
    if (Array.isArray(object)) {
      if (typeof key === 'number') {
        object[key] = value
        return
      }
      if (key === 'length') {
        object.length = this.requireNumber(value, node, 'set `length` to')
        return
      }
      this.fail(
        node,
        `Cannot set \`${key}\` on an array.`,
        'Assign to an index, e.g. `arr[0] = 1`, or use push.',
      )
    }
    if (isValueObject(object)) {
      const indexed = object.indexed
      if (indexed !== undefined && typeof key === 'number') {
        this.guard(node, () => indexed.set(key, value))
        return
      }
      object.properties.set(String(key), value)
      return
    }
    this.fail(
      node,
      `Cannot set \`${key}\` on ${typeName(object)}.`,
      'Only objects, class instances and arrays can have properties assigned.',
    )
  }

  private iterableToArray(value: Value, node: AnyNode): Value[] {
    if (Array.isArray(value)) return [...value]
    if (typeof value === 'string') return [...value]
    if (isValueObject(value) && value.indexed !== undefined) {
      const indexed = value.indexed
      return this.guard(node, () => {
        const items: Value[] = []
        for (let index = 0; index < indexed.length(); index += 1) items.push(indexed.get(index))
        return items
      })
    }
    this.fail(
      node,
      `\`for...of\` needs an array or a string, but got ${typeName(value)}.`,
      'Loop over an array. To walk a linked structure, use a `while` loop with a pointer instead.',
    )
  }

  private requireNumber(value: Value, node: AnyNode, action: string): number {
    if (typeof value !== 'number') {
      this.fail(node, `Cannot ${action} ${typeName(value)}.`, 'That operation needs a number.')
    }
    return value
  }

  private binary(operator: string, left: Value, right: Value, node: AnyNode): Value {
    switch (operator) {
      case '===':
        return left === right
      case '!==':
        return left !== right
      case '==':
        return looseEquals(left, right)
      case '!=':
        return !looseEquals(left, right)
      case '+': {
        if (typeof left === 'string' || typeof right === 'string') {
          return stringify(left) + stringify(right)
        }
        if (typeof left === 'number' && typeof right === 'number') return left + right
        this.fail(
          node,
          `Cannot add ${typeName(left)} and ${typeName(right)}.`,
          '`+` works on two numbers, or on strings to join them.',
        )
        break
      }
      case '-':
      case '*':
      case '/':
      case '%':
      case '**': {
        const a = this.requireNumber(left, node, `use \`${operator}\` on`)
        const b = this.requireNumber(right, node, `use \`${operator}\` on`)
        switch (operator) {
          case '-':
            return a - b
          case '*':
            return a * b
          case '/':
            return a / b
          case '%':
            return a % b
          default:
            return a ** b
        }
      }
      case '<':
      case '<=':
      case '>':
      case '>=': {
        if (typeof left === 'number' && typeof right === 'number') {
          return compareNumbers(operator, left, right)
        }
        if (typeof left === 'string' && typeof right === 'string') {
          return compareStrings(operator, left, right)
        }
        this.fail(
          node,
          `Cannot compare ${typeName(left)} with ${typeName(right)} using \`${operator}\`.`,
          'Compare two numbers, or two strings. To check whether an object is missing, use `=== null`.',
        )
        break
      }
      default:
        reject(node)
    }
    reject(node)
  }
}

// ---------------------------------------------------------------------------
// Loop budget diagnostics
// ---------------------------------------------------------------------------

interface Sample {
  readonly name: string
  readonly snapshot: Snapshot
  /** False for a builtin or an injected handle, which is not the reader's. */
  readonly local: boolean
}

/**
 * Watches one execution of one loop and, when it overruns, builds the teaching
 * panel's payload: which variables the test reads, what they were on the first
 * iteration, what they are now, and a hint aimed at the shape of the mistake.
 */
class LoopWatch {
  private iterations = 0
  private first: Sample[] | null = null
  private latest: Sample[] = []
  private readonly names: string[]

  constructor(
    private readonly loopNode: AnyNode,
    private readonly testNode: AnyNode | null,
    private readonly limit: number,
  ) {
    this.names = testNode === null ? [] : collectReadNames(testNode)
  }

  /** Sample the test variables; called right after each test evaluation. */
  record(env: Env): void {
    const sample = this.names.map((name) => {
      const binding = env.lookupLocal(name)
      return {
        name,
        snapshot: capture(binding === undefined ? undefined : binding.value),
        local: binding !== undefined,
      }
    })
    if (this.first === null) this.first = sample
    this.latest = sample
  }

  /** Count an iteration that is about to run its body. */
  tick(env: Env, parsed: ParsedProgram): void {
    this.iterations += 1
    if (this.iterations <= this.limit) return
    this.record(env)
    throw this.overflow(parsed)
  }

  private overflow(parsed: ParsedProgram): NoracursionError {
    const anchor = this.testNode ?? this.loopNode
    const loopLine = positionOf(anchor).line
    const loopSource = parsed.sourceLine(loopLine).trim()

    const firstSamples = this.first ?? this.latest
    const testVariables: TestVariable[] = this.names
      .map((name, index) => ({ name, index }))
      // `while (i < list.length)` reads `list`, but `list` is the injected
      // handle, and rendering it would fill the panel with its own method list
      // instead of the one variable that matters.
      .filter(({ index }) => this.latest[index]?.local ?? false)
      .map(({ name, index }) => {
        const before = formatSnapshot(firstSamples[index]?.snapshot ?? { kind: 'elided' })
        const after = formatSnapshot(this.latest[index]?.snapshot ?? { kind: 'elided' })
        return { name, first: before, latest: after, changed: before !== after }
      })

    return new NoracursionError(
      `This loop ran ${this.limit} times and never stopped.`,
      {
        kind: 'loop-budget',
        loopLine,
        loopSource,
        iterations: this.iterations - 1,
        testVariables,
      },
      buildLoopHint(this.loopNode, testVariables, this.latest),
    )
  }
}

/**
 * The advice half of a loop diagnostic.
 *
 * The line number and the loop's source text live on the error's `detail`, so
 * the teaching panel lays those out itself; repeating them here would print the
 * same line twice.
 */
function buildLoopHint(
  loopNode: AnyNode,
  testVariables: readonly TestVariable[],
  samples: readonly Sample[],
): string {
  const keyword = loopNode.type === 'ForStatement' ? '`for`' : '`while`'
  const unchanged = testVariables.filter((variable) => !variable.changed)
  const body = loopBody(loopNode)

  // Most specific shape first: a `continue` that jumps over the update.
  if (body !== null) {
    for (const variable of unchanged) {
      if (continueSkipsUpdate(body, variable.name)) {
        return `\`${variable.name}\` is updated after a \`continue\`, so on the iterations that hit the \`continue\` it never changes. Move the update above the \`continue\`, or into the loop header.`
      }
    }
  }

  if (unchanged.length > 0) {
    const variable = unchanged[0]
    const assigned = body !== null && assignsTo(body, variable.name)
    if (!assigned) {
      const sample = samples.find((candidate) => candidate.name === variable.name)
      const suggestion = suggestAdvance(
        body,
        variable.name,
        sample === undefined ? null : sample.snapshot,
      )
      const fix =
        suggestion === null
          ? `Something inside the loop has to change \`${variable.name}\`.`
          : `Try adding \`${suggestion}\` before the closing brace.`
      return `\`${variable.name}\` started as ${variable.first} and is still ${variable.first}. A ${keyword} loop only ends when its condition becomes false, and nothing in the body changes \`${variable.name}\`. ${fix}`
    }
    return `\`${variable.name}\` is assigned inside the loop but still ends up as ${variable.latest} every time, so the condition never becomes false. Check that the assignment actually moves it towards ending the loop.`
  }

  const backwards = findBackwardsCounter(loopNode, testVariables)
  if (backwards !== null) {
    return `\`${backwards.name}\` is moving from ${backwards.first} to ${backwards.latest} — away from the value that would end the loop, not towards it. Check the direction of the update.`
  }

  const summary = testVariables
    .map((variable) => `\`${variable.name}\` went from ${variable.first} to ${variable.latest}`)
    .join(', ')
  return `${summary === '' ? 'The condition never became false.' : `${summary}, and the condition never became false.`} A ${keyword} loop ends only when its condition is false — check what would have to change for that to happen.`
}

function loopBody(loopNode: AnyNode): AnyNode | null {
  if (
    loopNode.type === 'WhileStatement' ||
    loopNode.type === 'DoWhileStatement' ||
    loopNode.type === 'ForStatement' ||
    loopNode.type === 'ForOfStatement'
  ) {
    return loopNode.body
  }
  return null
}

/** Does anything in this subtree assign to `name`? */
function assignsTo(root: AnyNode, name: string): boolean {
  let found = false
  walk(root, (node) => {
    if (found) return false
    if (
      node.type === 'AssignmentExpression' &&
      node.left.type === 'Identifier' &&
      node.left.name === name
    ) {
      found = true
    }
    if (
      node.type === 'UpdateExpression' &&
      node.argument.type === 'Identifier' &&
      node.argument.name === name
    ) {
      found = true
    }
    return !found
  })
  return found
}

/** Field names that almost always mean "the next thing" in a teaching structure. */
const LINK_FIELDS = ['next', 'left', 'right', 'child', 'parent', 'head', 'tail', 'sibling']

/**
 * Work out the edit that would advance the loop: `current = current.next;`.
 *
 * The value itself is the better evidence, not the body. `while (current !==
 * null) { console.log(current.value) }` only ever mentions `.value`, but the
 * fix is `.next` — so look for a field on the current value that is itself a
 * link (an object, or `null`, which is where a list ends) before falling back
 * to whatever property the body happens to touch.
 */
function suggestAdvance(
  body: AnyNode | null,
  name: string,
  snapshot: Snapshot | null,
): string | null {
  if (snapshot !== null && snapshot.kind === 'object') {
    const links = snapshot.entries
      .filter(([, value]) => isLinkShaped(value))
      .map(([field]) => field)
    const preferred = LINK_FIELDS.find((field) => links.includes(field))
    if (preferred !== undefined) return `${name} = ${name}.${preferred};`
    if (links.length > 0) return `${name} = ${name}.${links[0]};`
  }

  if (body === null) return null
  let property: string | null = null
  walk(body, (node) => {
    if (property !== null) return false
    if (
      node.type === 'MemberExpression' &&
      !node.computed &&
      node.object.type === 'Identifier' &&
      node.object.name === name &&
      node.property.type === 'Identifier'
    ) {
      property = node.property.name
    }
    return property === null
  })
  return property === null ? null : `${name} = ${name}.${property};`
}

/** An object or a `null` — i.e. something a pointer could walk along. */
function isLinkShaped(snapshot: Snapshot): boolean {
  if (snapshot.kind === 'object' || snapshot.kind === 'cyclic') return true
  return snapshot.kind === 'primitive' && snapshot.value === null
}

/** A `continue` that appears before the only update to `name`. */
function continueSkipsUpdate(body: AnyNode, name: string): boolean {
  let continueAt: number | null = null
  let updateAt: number | null = null
  walk(body, (node) => {
    if (node.type === 'ContinueStatement' && continueAt === null) continueAt = node.start
    const isUpdate =
      (node.type === 'AssignmentExpression' &&
        node.left.type === 'Identifier' &&
        node.left.name === name) ||
      (node.type === 'UpdateExpression' &&
        node.argument.type === 'Identifier' &&
        node.argument.name === name)
    if (isUpdate && updateAt === null) updateAt = node.start
    return true
  })
  return continueAt !== null && updateAt !== null && continueAt < updateAt
}

/** A numeric counter drifting away from the bound it is compared against. */
function findBackwardsCounter(
  loopNode: AnyNode,
  testVariables: readonly TestVariable[],
): TestVariable | null {
  const test =
    loopNode.type === 'WhileStatement' || loopNode.type === 'DoWhileStatement'
      ? loopNode.test
      : loopNode.type === 'ForStatement'
        ? loopNode.test
        : null
  if (test === null || test === undefined || test.type !== 'BinaryExpression') return null
  const operator = test.operator
  if (operator !== '<' && operator !== '<=' && operator !== '>' && operator !== '>=') return null
  const side = test.left.type === 'Identifier' ? test.left.name : null
  if (side === null) return null
  const variable = testVariables.find((candidate) => candidate.name === side)
  if (variable === undefined) return null
  const first = Number(variable.first)
  const latest = Number(variable.latest)
  if (Number.isNaN(first) || Number.isNaN(latest) || first === latest) return null
  const risingWouldEnd = operator === '<' || operator === '<='
  const rising = latest > first
  return rising === risingWouldEnd ? null : variable
}

// ---------------------------------------------------------------------------
// Small AST helpers
// ---------------------------------------------------------------------------

const MODULE_DECLARATION_TYPES: ReadonlySet<string> = new Set([
  'ImportDeclaration',
  'ExportNamedDeclaration',
  'ExportDefaultDeclaration',
  'ExportAllDeclaration',
])

function isModuleDeclaration(node: Statement | ModuleDeclaration): node is ModuleDeclaration {
  return MODULE_DECLARATION_TYPES.has(node.type)
}

/**
 * Names a loop test reads. Property names in `a.b` are skipped — `b` is not a
 * variable — but the object `a` counts, which is what makes the linked-list
 * diagnostic work.
 */
function collectReadNames(test: AnyNode): string[] {
  const names: string[] = []
  walk(test, (node) => {
    if (node.type === 'MemberExpression' && !node.computed) {
      walk(node.object, (inner) => {
        if (inner.type === 'Identifier' && !names.includes(inner.name)) names.push(inner.name)
        return true
      })
      return false
    }
    if (node.type === 'Identifier' && !names.includes(node.name)) names.push(node.name)
    return true
  })
  return names
}

function hoistVars(body: readonly Statement[], env: Env): void {
  for (const statement of body) {
    walk(statement, (node) => {
      // Do not descend into nested functions: their `var`s belong to them.
      if (
        node.type === 'FunctionDeclaration' ||
        node.type === 'FunctionExpression' ||
        node.type === 'ArrowFunctionExpression'
      ) {
        return false
      }
      if (node.type === 'VariableDeclaration' && node.kind === 'var') {
        for (const declarator of node.declarations) {
          if (declarator.id.type === 'Identifier' && !env.functionScope().has(declarator.id.name)) {
            env.declare(declarator.id.name, 'var', undefined)
          }
        }
      }
      return true
    })
  }
}

/** The plain names a declaration introduces. Patterns are handled elsewhere. */
function declaredNames(node: VariableDeclaration): string[] {
  const names: string[] = []
  for (const declarator of node.declarations) {
    if (declarator.id.type === 'Identifier') names.push(declarator.id.name)
  }
  return names
}

/** A child scope holding this iteration's own copy of the loop variables. */
function copyBindings(scope: Env, names: readonly string[]): Env {
  if (names.length === 0) return scope
  const iteration = scope.child()
  for (const name of names) {
    const binding = scope.lookup(name)
    if (binding !== undefined) iteration.declare(name, binding.kind, binding.value)
  }
  return iteration
}

/** Carries any change the body made back to the binding the update sees. */
function writeBack(iteration: Env, scope: Env, names: readonly string[]): void {
  if (iteration === scope) return
  for (const name of names) {
    const from = iteration.lookup(name)
    const to = scope.lookup(name)
    if (from !== undefined && to !== undefined) to.value = from.value
  }
}

function kindOf(node: VariableDeclaration): 'let' | 'const' | 'var' {
  return node.kind === 'const' ? 'const' : node.kind === 'var' ? 'var' : 'let'
}

function nameOf(node: FunctionNode): string {
  return node.type !== 'ArrowFunctionExpression' && node.id !== null && node.id !== undefined
    ? node.id.name
    : ''
}

function typeofValue(value: Value): string {
  if (value === null) return 'object'
  if (value === undefined) return 'undefined'
  if (Array.isArray(value)) return 'object'
  if (typeof value === 'object') {
    return value.type === 'object' ? 'object' : 'function'
  }
  return typeof value
}

function looseEquals(left: Value, right: Value): boolean {
  if (left === null || left === undefined) return right === null || right === undefined
  if (right === null || right === undefined) return false
  if (typeof left === typeof right) return left === right
  if (typeof left === 'number' && typeof right === 'string') return left === Number(right)
  if (typeof left === 'string' && typeof right === 'number') return Number(left) === right
  if (typeof left === 'boolean') return looseEquals(left ? 1 : 0, right)
  if (typeof right === 'boolean') return looseEquals(left, right ? 1 : 0)
  return left === right
}

function compareNumbers(operator: string, a: number, b: number): boolean {
  switch (operator) {
    case '<':
      return a < b
    case '<=':
      return a <= b
    case '>':
      return a > b
    default:
      return a >= b
  }
}

function compareStrings(operator: string, a: string, b: string): boolean {
  switch (operator) {
    case '<':
      return a < b
    case '<=':
      return a <= b
    case '>':
      return a > b
    default:
      return a >= b
  }
}

function propertyKeyOf(value: Value): string | number {
  if (typeof value === 'number') return value
  return stringify(value)
}

/**
 * acorn's node unions are wider than the subset accepts (a property key can be
 * a `PrivateIdentifier`, a call argument a `SpreadElement`). Lint bans type
 * assertions, so these narrow with a real check and reject anything else with a
 * line number rather than smuggling the wrong node type through.
 */
function staticKey(node: AnyNode, onReject: (node: AnyNode) => never): string {
  if (node.type === 'Identifier') return node.name
  if (node.type === 'Literal') {
    if (typeof node.value === 'string') return node.value
    if (typeof node.value === 'number') return String(node.value)
  }
  onReject(node)
}

function keyExpression(node: AnyNode, onReject: (node: AnyNode) => never): Expression {
  if (isExpression(node)) return node
  onReject(node)
}

function valueExpression(node: AnyNode, onReject: (node: AnyNode) => never): Expression {
  if (isExpression(node)) return node
  onReject(node)
}

function objectExpression(node: AnyNode, onReject: (node: AnyNode) => never): Expression {
  if (isExpression(node)) return node
  onReject(node)
}

function leftExpression(node: AnyNode, onReject: (node: AnyNode) => never): Expression {
  if (isExpression(node)) return node
  onReject(node)
}

function targetExpression(node: AnyNode, onReject: (node: AnyNode) => never): Expression {
  if (isExpression(node)) return node
  onReject(node)
}

const NON_EXPRESSION_TYPES: ReadonlySet<string> = new Set([
  'SpreadElement',
  'RestElement',
  'PrivateIdentifier',
  'Super',
  'Property',
  'AssignmentPattern',
  'ArrayPattern',
  'ObjectPattern',
])

function isExpression(node: AnyNode): node is Expression {
  return !NON_EXPRESSION_TYPES.has(node.type)
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Parse and interpret `source`, yielding a `Step` at every observable point.
 *
 * The caller drives the generator, which is what gives the host line-accurate
 * stepping, a variables panel, a call-stack view, and — because the trace can
 * be recorded as it goes — step-backward without inverting a single mutation.
 */
export function* interpret(
  source: string,
  options: RunOptions = {},
): Generator<Step, RunSummary, void> {
  const parsed = parse(source)
  validateSubset(parsed.program)
  const interpreter = new Interpreter(parsed, options)
  return yield* interpreter.run()
}
