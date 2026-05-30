import { ValueType } from './Types.js';
export class Interpreter {
    localization;
    globalScope;
    coreScope;
    constructor(parentScope, coreScope, localization = {}) {
        this.localization = localization;
        this.coreScope = coreScope || new HankScope();
        this.globalScope = new HankScope(parentScope || this.coreScope);
    }
    get scope() {
        return this.globalScope;
    }
    isError(val) {
        return val.type === ValueType.Error;
    }
    getLocalization() {
        return this.localization;
    }
    run(ast) {
        const res = this.evalInScope(ast, this.globalScope);
        switch (res.kind) {
            case 'Value':
            case 'Return':
                return res.value;
            case 'Break':
                return { type: ValueType.Void };
            case 'Error':
                return res.error;
        }
    }
    eval(node) {
        const res = this.evalInScope(node, this.globalScope);
        switch (res.kind) {
            case 'Value':
            case 'Return':
                return res.value;
            case 'Break':
                return { type: ValueType.Opaque, label: '__ControlFlow', value: 'Break' };
            case 'Error':
                return res.error;
        }
    }
    evalInScope(node, scope) {
        switch (node.kind) {
            case 'Literal':
                return { kind: 'Value', value: node.value };
            case 'Error': {
                const args = [];
                for (const argExpr of node.args) {
                    const res = this.evalInScope(argExpr, scope);
                    if (res.kind !== 'Value')
                        return res;
                    args.push(res.value);
                }
                return { kind: 'Value', value: { type: ValueType.Error, code: node.code, args } };
            }
            case 'Ident':
                return { kind: 'Value', value: node.isCore ? this.coreScope.get(node.name) : scope.get(node.name) };
            case 'Assign': {
                const res = this.evalInScope(node.value, scope);
                if (res.kind === 'Value') {
                    scope.set(node.name, res.value);
                    return { kind: 'Value', value: res.value };
                }
                return res;
            }
            case 'Block': {
                // --- TASK HOISTING PASS ---
                for (const stmt of node.stmts) {
                    if (stmt.kind === 'Assign' && stmt.value.kind === 'FuncDef') {
                        const res = this.evalInScope(stmt.value, scope);
                        if (res.kind === 'Value')
                            scope.set(stmt.name, res.value);
                    }
                    if (stmt.kind === 'Assign' && stmt.value.kind === 'Assign' && stmt.value.value.kind === 'FuncDef') {
                        const res = this.evalInScope(stmt.value.value, scope);
                        if (res.kind === 'Value')
                            scope.set(stmt.value.name, res.value);
                    }
                }
                let last = { type: ValueType.Void };
                for (const stmt of node.stmts) {
                    if (stmt.kind === 'Assign') {
                        if (stmt.value.kind === 'FuncDef')
                            continue;
                        if (stmt.value.kind === 'Assign' && stmt.value.value.kind === 'FuncDef')
                            continue;
                    }
                    const res = this.evalInScope(stmt, scope);
                    if (res.kind === 'Value') {
                        last = res.value;
                    }
                    else {
                        return res;
                    }
                }
                return { kind: 'Value', value: last };
            }
            case 'FuncDef':
                return {
                    kind: 'Value',
                    value: {
                        type: ValueType.Task,
                        task: {
                            isNative: false,
                            name: 'anonymous',
                            params: node.params,
                            body: node.body,
                            closure: scope
                        }
                    }
                };
            case 'FuncCall': {
                const targetRes = this.evalInScope(node.target, scope);
                if (targetRes.kind !== 'Value')
                    return targetRes;
                const target = targetRes.value;
                const args = [];
                for (const argExpr of node.args) {
                    const argRes = this.evalInScope(argExpr, scope);
                    if (argRes.kind !== 'Value')
                        return argRes;
                    args.push(argRes.value);
                }
                return this.callInternal(target, args, scope);
            }
            case 'Field': {
                const collRes = this.evalInScope(node.collection, scope);
                if (collRes.kind !== 'Value')
                    return collRes;
                const coll = collRes.value;
                if (coll.type === ValueType.Map) {
                    return { kind: 'Value', value: coll.value.get(node.fieldName) || { type: ValueType.Void } };
                }
                else if (coll.type === ValueType.Array && node.fieldName === 'length') {
                    return { kind: 'Value', value: { type: ValueType.Number, value: coll.value.length } };
                }
                else if (coll.type === ValueType.String && node.fieldName === 'length') {
                    return { kind: 'Value', value: { type: ValueType.Number, value: coll.value.length } };
                }
                return { kind: 'Value', value: { type: ValueType.Void } };
            }
            case 'Map': {
                const map = new Map();
                for (const [k, vExpr] of node.fields) {
                    const res = this.evalInScope(vExpr, scope);
                    if (res.kind === 'Value')
                        map.set(k, res.value);
                    else
                        return res;
                }
                return { kind: 'Value', value: { type: ValueType.Map, value: map } };
            }
            case 'Array': {
                const items = [];
                for (const itemExpr of node.items) {
                    const res = this.evalInScope(itemExpr, scope);
                    if (res.kind === 'Value')
                        items.push(res.value);
                    else
                        return res;
                }
                return { kind: 'Value', value: { type: ValueType.Array, value: items } };
            }
            case 'UnOp': {
                const targetRes = this.evalInScope(node.target, scope);
                if (targetRes.kind !== 'Value')
                    return targetRes;
                const val = targetRes.value;
                switch (node.op) {
                    case '!': return { kind: 'Value', value: this.isTruthy(val) ? { type: ValueType.Void } : { type: ValueType.Number, value: 1 } };
                    case '?': return { kind: 'Value', value: val };
                    case '^': return { kind: 'Return', value: val };
                    default: return { kind: 'Value', value: { type: ValueType.Void } };
                }
            }
            case 'FlowControl': {
                const condRes = this.evalInScope(node.condition, scope);
                let branchRes;
                if (condRes.kind === 'Value') {
                    if (this.isTruthy(condRes.value)) {
                        branchRes = this.evalInScope(node.success, scope);
                    }
                    else if (node.fallback) {
                        branchRes = this.evalInScope(node.fallback, scope);
                    }
                    else {
                        branchRes = { kind: 'Value', value: { type: ValueType.Void } };
                    }
                }
                else {
                    branchRes = condRes;
                }
                if (branchRes.kind === 'Error' && node.rescue) {
                    const rescueScope = new HankScope(scope);
                    if (node.catchVar)
                        rescueScope.set(node.catchVar, branchRes.error);
                    return this.evalInScope(node.rescue, rescueScope);
                }
                return branchRes;
            }
        }
    }
    callInternal(task, args, scope) {
        if (task.type !== ValueType.Task || !task.task) {
            return { kind: 'Error', error: { type: ValueType.Error, code: 4001, args: [{ type: ValueType.String, value: this.valToString(task) }] } };
        }
        if (task.task.isNative) {
            try {
                const res = task.task.native(args, this);
                if (res.type === ValueType.Opaque && res.label === '__ControlFlow' && String(res.value) === 'Break') {
                    return { kind: 'Break' };
                }
                if (res.type === ValueType.Error)
                    return { kind: 'Error', error: res };
                return { kind: 'Value', value: res };
            }
            catch (e) {
                return { kind: 'Error', error: { type: ValueType.Error, code: 4006, args: [{ type: ValueType.String, value: String(e) }] } };
            }
        }
        else {
            const t = task.task;
            if (args.length > (t.params?.length || 0)) {
                return { kind: 'Error', error: { type: ValueType.Error, code: 4002, args: [] } };
            }
            const taskScope = new HankScope(t.closure);
            const params = t.params || [];
            for (let i = 0; i < params.length; i++) {
                const p = params[i];
                let val = { type: ValueType.Void };
                if (i < args.length) {
                    val = args[i];
                }
                else if (p.defaultValue) {
                    const res = this.evalInScope(p.defaultValue, taskScope);
                    if (res.kind === 'Value')
                        val = res.value;
                    else
                        return res;
                }
                else if (!p.isOptional) {
                    return { kind: 'Error', error: { type: ValueType.Error, code: 4003, args: [{ type: ValueType.String, value: p.name }] } };
                }
                taskScope.set(p.name, val);
            }
            const res = this.evalInScope(t.body, taskScope);
            if (res.kind === 'Value' || res.kind === 'Return') {
                if (res.value.type === ValueType.Error)
                    return { kind: 'Error', error: res.value };
                return { kind: 'Value', value: res.value };
            }
            return res;
        }
    }
    call(task, args) {
        let finalArgs = args;
        if (task.type === ValueType.Task && task.task && !task.task.isNative && task.task.params) {
            if (args.length > task.task.params.length) {
                finalArgs = args.slice(0, task.task.params.length);
            }
        }
        const res = this.callInternal(task, finalArgs, this.globalScope);
        switch (res.kind) {
            case 'Value':
            case 'Return':
                return res.value;
            case 'Break':
                return { type: ValueType.Opaque, label: '__ControlFlow', value: 'Break' };
            case 'Error':
                return res.error;
        }
    }
    isTruthy(v) {
        return v.type !== ValueType.Void;
    }
    valToString(v) {
        switch (v.type) {
            case ValueType.String: return v.value;
            case ValueType.Number: {
                let s = v.value.toString();
                if (s.endsWith('.0'))
                    s = s.substring(0, s.length - 2);
                return s;
            }
            case ValueType.Void: return 'Void';
            case ValueType.Array: return '[Array]';
            case ValueType.Map: return '[Map]';
            case ValueType.Opaque: return `[Opaque:${v.label}]`;
            case ValueType.Task: return '[Task]';
            case ValueType.Error: return `[Error:${v.code}]`;
            default: return 'Void';
        }
    }
}
export class HankScope {
    parent;
    values = new Map();
    constructor(parent) {
        this.parent = parent;
    }
    get(name) {
        if (this.values.has(name))
            return this.values.get(name);
        if (this.parent)
            return this.parent.get(name);
        return { type: ValueType.Void };
    }
    set(name, val) {
        this.values.set(name, val);
    }
    exists(name) {
        return this.values.has(name) || (this.parent ? this.parent.exists(name) : false);
    }
}
//# sourceMappingURL=Interpreter.js.map