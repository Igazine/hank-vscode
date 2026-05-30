"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HANK_STDLIB_METADATA = void 0;
exports.HANK_STDLIB_METADATA = {
    log: {
        name: 'log',
        description: 'Output and debugging tasks.',
        tasks: {
            print: {
                name: 'print',
                signature: 'log.print(...args)',
                description: 'Outputs arguments to the standard output stream.',
                parameters: [{ label: '...args', description: 'Values to serialize and print.' }],
                example: 'log.print("Hello", user_name)'
            },
            error: {
                name: 'error',
                signature: 'log.error(...args)',
                description: 'Outputs arguments to the error stream.',
                parameters: [{ label: '...args', description: 'Values to serialize and print to stderr.' }],
                example: 'log.error("Critical failure:", err_msg)'
            },
            warn: {
                name: 'warn',
                signature: 'log.warn(...args)',
                description: 'Outputs arguments with a warning decoration.',
                parameters: [{ label: '...args', description: 'Values to serialize and print with warning label.' }]
            }
        }
    },
    runtime: {
        name: 'runtime',
        description: 'Engine control and timing.',
        tasks: {
            halt: {
                name: 'halt',
                signature: 'runtime.halt(?code)',
                description: 'Immediately terminates script execution and returns the code to the host.',
                parameters: [{ label: '?code', description: 'Optional numeric exit code (Default: 0).' }]
            },
            elapsedTime: {
                name: 'elapsedTime',
                signature: 'runtime.elapsedTime()',
                description: 'Returns monotonic milliseconds since the engine started.',
                parameters: []
            },
            signal: {
                name: 'signal',
                signature: 'runtime.signal(val)',
                description: 'Emits a custom event signal to the host runner.',
                parameters: [{ label: 'val', description: 'Any Hank value to send to the host.' }]
            }
        }
    },
    loop: {
        name: 'loop',
        description: 'Iteration and flow termination.',
        tasks: {
            while: {
                name: 'while',
                signature: 'loop.while(condition_task, body_task)',
                description: 'Repeatedly executes body_task while condition_task returns truthy.',
                parameters: [
                    { label: 'condition_task', description: 'A Task that returns a truthy value to continue.' },
                    { label: 'body_task', description: 'The Task to execute in the loop body.' }
                ]
            },
            break: {
                name: 'break',
                signature: 'loop.break()',
                description: 'Immediately exits the innermost loop.',
                parameters: []
            }
        }
    },
    str: {
        name: 'str',
        description: 'String manipulation.',
        tasks: {
            length: {
                name: 'length',
                signature: 'str.length(s)',
                description: 'Returns the number of characters in the string.',
                parameters: [{ label: 's', description: 'The string to measure.' }]
            },
            format: {
                name: 'format',
                signature: 'str.format(tmpl, ...args)',
                description: 'Replaces %1, %2, etc. in the template with provided arguments.',
                parameters: [
                    { label: 'tmpl', description: 'Template string containing %1, %2, etc.' },
                    { label: '...args', description: 'Values to inject into the template.' }
                ]
            },
            concat: {
                name: 'concat',
                signature: 'str.concat(...args)',
                description: 'Joins all arguments into a single string.',
                parameters: [{ label: '...args', description: 'Values to concatenate.' }]
            },
            trim: {
                name: 'trim',
                signature: 'str.trim(s)',
                description: 'Removes leading and trailing whitespace.',
                parameters: [{ label: 's', description: 'The string to trim.' }]
            }
        }
    },
    arr: {
        name: 'arr',
        description: 'Array management.',
        tasks: {
            length: {
                name: 'length',
                signature: 'arr.length(a)',
                description: 'Returns the number of items in the array.',
                parameters: [{ label: 'a', description: 'The target array.' }]
            },
            get: {
                name: 'get',
                signature: 'arr.get(a, index)',
                description: 'Returns the item at the specified index or Void if out of bounds.',
                parameters: [
                    { label: 'a', description: 'The target array.' },
                    { label: 'index', description: 'The numeric index to retrieve.' }
                ]
            },
            push: {
                name: 'push',
                signature: 'arr.push(a, item)',
                description: 'Appends an item to the array (In-place mutation).',
                parameters: [
                    { label: 'a', description: 'The target array.' },
                    { label: 'item', description: 'The value to append.' }
                ]
            },
            pop: {
                name: 'pop',
                signature: 'arr.pop(a)',
                description: 'Removes and returns the last item of the array.',
                parameters: [{ label: 'a', description: 'The target array.' }]
            },
            each: {
                name: 'each',
                signature: 'arr.each(a, callback_task)',
                description: 'Iterates over a snapshot of the array. Callback receives (item, index).',
                parameters: [
                    { label: 'a', description: 'The target array.' },
                    { label: 'callback_task', description: 'A Task that receives (item, ?index).' }
                ]
            }
        }
    },
    map: {
        name: 'map',
        description: 'Map access and mutation.',
        tasks: {
            get: {
                name: 'get',
                signature: 'map.get(m, key)',
                description: 'Returns the value for the string key, or Void.',
                parameters: [
                    { label: 'm', description: 'The target map.' },
                    { label: 'key', description: 'The string key to look up.' }
                ]
            },
            set: {
                name: 'set',
                signature: 'map.set(m, key, val)',
                description: 'Updates a key-value pair in the map (In-place mutation).',
                parameters: [
                    { label: 'm', description: 'The target map.' },
                    { label: 'key', description: 'The string key.' },
                    { label: 'val', description: 'The value to assign.' }
                ]
            },
            keys: {
                name: 'keys',
                signature: 'map.keys(m)',
                description: 'Returns an array of all keys in the map.',
                parameters: [{ label: 'm', description: 'The target map.' }]
            }
        }
    },
    math: {
        name: 'math',
        description: 'Arithmetic and comparisons.',
        tasks: {
            add: {
                name: 'add',
                signature: 'math.add(...nums)',
                description: 'Returns the sum of all arguments.',
                parameters: [{ label: '...nums', description: 'Numbers to add.' }]
            },
            sub: {
                name: 'sub',
                signature: 'math.sub(a, b)',
                description: 'Returns the difference (a - b).',
                parameters: [
                    { label: 'a', description: 'Initial value.' },
                    { label: 'b', description: 'Value to subtract.' }
                ]
            },
            mul: {
                name: 'mul',
                signature: 'math.mul(...nums)',
                description: 'Returns the product of all arguments.',
                parameters: [{ label: '...nums', description: 'Numbers to multiply.' }]
            },
            div: {
                name: 'div',
                signature: 'math.div(a, b)',
                description: 'Returns the quotient (a / b).',
                parameters: [
                    { label: 'a', description: 'Dividend.' },
                    { label: 'b', description: 'Divisor.' }
                ]
            },
            gt: {
                name: 'gt',
                signature: 'math.gt(a, b)',
                description: 'Returns 1 if a > b, else Void.',
                parameters: [
                    { label: 'a', description: 'First value.' },
                    { label: 'b', description: 'Second value.' }
                ]
            },
            lt: {
                name: 'lt',
                signature: 'math.lt(a, b)',
                description: 'Returns 1 if a < b, else Void.',
                parameters: [
                    { label: 'a', description: 'First value.' },
                    { label: 'b', description: 'Second value.' }
                ]
            }
        }
    },
    logic: {
        name: 'logic',
        description: 'Functional logical composition.',
        tasks: {
            and: {
                name: 'and',
                signature: 'logic.and(...args)',
                description: 'Returns the last arg if all are truthy, else Void.',
                parameters: [{ label: '...args', description: 'Values to evaluate.' }]
            },
            or: {
                name: 'or',
                signature: 'logic.or(...args)',
                description: 'Returns the first truthy arg, else Void.',
                parameters: [{ label: '...args', description: 'Values to evaluate.' }]
            },
            eq: {
                name: 'eq',
                signature: 'logic.eq(a, b)',
                description: 'Returns 1 if values are deeply equal, else Void.',
                parameters: [
                    { label: 'a', description: 'First value.' },
                    { label: 'b', description: 'Second value.' }
                ]
            }
        }
    },
    err: {
        name: 'err',
        description: 'Error inspection.',
        tasks: {
            code: {
                name: 'code',
                signature: 'err.code(e)',
                description: 'Returns the numeric code of the error.',
                parameters: [{ label: 'e', description: 'The native Error object.' }]
            },
            message: {
                name: 'message',
                signature: 'err.message(e)',
                description: 'Returns the localized error message.',
                parameters: [{ label: 'e', description: 'The native Error object.' }]
            },
            isError: {
                name: 'isError',
                signature: 'err.isError(val)',
                description: 'Returns 1 if the value is of type Error.',
                parameters: [{ label: 'val', description: 'The value to check.' }]
            }
        }
    },
    json: {
        name: 'json',
        description: 'Data serialization.',
        tasks: {
            parse: {
                name: 'parse',
                signature: 'json.parse(s)',
                description: 'Converts a JSON string into Hank data structures.',
                parameters: [{ label: 's', description: 'JSON string.' }]
            },
            stringify: {
                name: 'stringify',
                signature: 'json.stringify(val)',
                description: 'Converts Hank data into a JSON string.',
                parameters: [{ label: 'val', description: 'Hank value to serialize.' }]
            }
        }
    }
};
//# sourceMappingURL=metadata.js.map