export interface HankTaskMetadata {
    name: string;
    signature: string;
    description: string;
    example?: string;
}

export interface HankModuleMetadata {
    name: string;
    description: string;
    tasks: Record<string, HankTaskMetadata>;
}

export const HANK_STDLIB_METADATA: Record<string, HankModuleMetadata> = {
    log: {
        name: 'log',
        description: 'Output and debugging tasks.',
        tasks: {
            print: {
                name: 'print',
                signature: 'log.print(...args)',
                description: 'Outputs arguments to the standard output stream.',
                example: 'log.print("Hello", user_name)'
            },
            error: {
                name: 'error',
                signature: 'log.error(...args)',
                description: 'Outputs arguments to the error stream.',
                example: 'log.error("Critical failure:", err_msg)'
            },
            warn: {
                name: 'warn',
                signature: 'log.warn(...args)',
                description: 'Outputs arguments with a warning decoration.'
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
                description: 'Immediately terminates script execution and returns the code to the host.'
            },
            elapsedTime: {
                name: 'elapsedTime',
                signature: 'runtime.elapsedTime()',
                description: 'Returns monotonic milliseconds since the engine started.'
            },
            signal: {
                name: 'signal',
                signature: 'runtime.signal(val)',
                description: 'Emits a custom event signal to the host runner.'
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
                description: 'Repeatedly executes body_task while condition_task returns truthy.'
            },
            break: {
                name: 'break',
                signature: 'loop.break()',
                description: 'Immediately exits the innermost loop.'
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
                description: 'Returns the number of characters in the string.'
            },
            format: {
                name: 'format',
                signature: 'str.format(tmpl, ...args)',
                description: 'Replaces %1, %2, etc. in the template with provided arguments.'
            },
            concat: {
                name: 'concat',
                signature: 'str.concat(...args)',
                description: 'Joins all arguments into a single string.'
            },
            trim: {
                name: 'trim',
                signature: 'str.trim(s)',
                description: 'Removes leading and trailing whitespace.'
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
                description: 'Returns the number of items in the array.'
            },
            get: {
                name: 'get',
                signature: 'arr.get(a, index)',
                description: 'Returns the item at the specified index or Void if out of bounds.'
            },
            push: {
                name: 'push',
                signature: 'arr.push(a, item)',
                description: 'Appends an item to the array (In-place mutation).'
            },
            pop: {
                name: 'pop',
                signature: 'arr.pop(a)',
                description: 'Removes and returns the last item of the array.'
            },
            each: {
                name: 'each',
                signature: 'arr.each(a, callback_task)',
                description: 'Iterates over a snapshot of the array. Callback receives (item, index).'
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
                description: 'Returns the value for the string key, or Void.'
            },
            set: {
                name: 'set',
                signature: 'map.set(m, key, val)',
                description: 'Updates a key-value pair in the map (In-place mutation).'
            },
            keys: {
                name: 'keys',
                signature: 'map.keys(m)',
                description: 'Returns an array of all keys in the map.'
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
                description: 'Returns the sum of all arguments.'
            },
            sub: {
                name: 'sub',
                signature: 'math.sub(a, b)',
                description: 'Returns the difference (a - b).'
            },
            mul: {
                name: 'mul',
                signature: 'math.mul(...nums)',
                description: 'Returns the product of all arguments.'
            },
            div: {
                name: 'div',
                signature: 'math.div(a, b)',
                description: 'Returns the quotient (a / b).'
            },
            gt: {
                name: 'gt',
                signature: 'math.gt(a, b)',
                description: 'Returns 1 if a > b, else Void.'
            },
            lt: {
                name: 'lt',
                signature: 'math.lt(a, b)',
                description: 'Returns 1 if a < b, else Void.'
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
                description: 'Returns the last arg if all are truthy, else Void.'
            },
            or: {
                name: 'or',
                signature: 'logic.or(...args)',
                description: 'Returns the first truthy arg, else Void.'
            },
            eq: {
                name: 'eq',
                signature: 'logic.eq(a, b)',
                description: 'Returns 1 if values are deeply equal, else Void.'
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
                description: 'Returns the numeric code of the error.'
            },
            message: {
                name: 'message',
                signature: 'err.message(e)',
                description: 'Returns the localized error message.'
            },
            isError: {
                name: 'isError',
                signature: 'err.isError(val)',
                description: 'Returns 1 if the value is of type Error.'
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
                description: 'Converts a JSON string into Hank data structures.'
            },
            stringify: {
                name: 'stringify',
                signature: 'json.stringify(val)',
                description: 'Converts Hank data into a JSON string.'
            }
        }
    }
};
