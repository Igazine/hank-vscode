export interface HankParameterMetadata {
    label: string;
    description?: string;
}

export interface HankTaskMetadata {
    name: string;
    signature: string;
    description: string;
    parameters: HankParameterMetadata[];
    example?: string;
}

export const HANK_STDLIB_METADATA: Record<string, HankTaskMetadata> = {
    // log
    log_print: {
        name: 'log_print',
        signature: 'log_print(...args)',
        description: 'Outputs arguments to the standard output stream.',
        parameters: [{ label: '...args', description: 'Values to serialize and print.' }],
        example: 'log_print("Hello", user_name)'
    },
    log_error: {
        name: 'log_error',
        signature: 'log_error(...args)',
        description: 'Outputs arguments to the error stream.',
        parameters: [{ label: '...args', description: 'Values to serialize and print to stderr.' }],
        example: 'log_error("Critical failure:", err_msg)'
    },
    log_warn: {
        name: 'log_warn',
        signature: 'log_warn(...args)',
        description: 'Outputs arguments with a warning decoration.',
        parameters: [{ label: '...args', description: 'Values to serialize and print with warning label.' }]
    },

    // runtime
    runtime_halt: {
        name: 'runtime_halt',
        signature: 'runtime_halt(?code)',
        description: 'Immediately terminates script execution and returns the code to the host.',
        parameters: [{ label: '?code', description: 'Optional numeric exit code (Default: 0).' }]
    },
    runtime_elapsedTime: {
        name: 'runtime_elapsedTime',
        signature: 'runtime_elapsedTime()',
        description: 'Returns monotonic milliseconds since the engine started.',
        parameters: []
    },
    runtime_signal: {
        name: 'runtime_signal',
        signature: 'runtime_signal(val)',
        description: 'Emits a custom event signal to the host runner.',
        parameters: [{ label: 'val', description: 'Any Hank value to send to the host.' }]
    },

    // loop
    loop_while: {
        name: 'loop_while',
        signature: 'loop_while(condition_task, body_task)',
        description: 'Repeatedly executes body_task while condition_task returns truthy.',
        parameters: [
            { label: 'condition_task', description: 'A Task that returns a truthy value to continue.' },
            { label: 'body_task', description: 'The Task to execute in the loop body.' }
        ]
    },
    loop_break: {
        name: 'loop_break',
        signature: 'loop_break()',
        description: 'Immediately exits the innermost loop.',
        parameters: []
    },

    // str
    str_length: {
        name: 'str_length',
        signature: 'str_length(s)',
        description: 'Returns the number of characters in the string.',
        parameters: [{ label: 's', description: 'The string to measure.' }]
    },
    str_format: {
        name: 'str_format',
        signature: 'str_format(tmpl, ...args)',
        description: 'Replaces %1, %2, etc. in the template with provided arguments.',
        parameters: [
            { label: 'tmpl', description: 'Template string containing %1, %2, etc.' },
            { label: '...args', description: 'Values to inject into the template.' }
        ]
    },
    str_concat: {
        name: 'str_concat',
        signature: 'str_concat(...args)',
        description: 'Joins all arguments into a single string.',
        parameters: [{ label: '...args', description: 'Values to concatenate.' }]
    },
    str_trim: {
        name: 'str_trim',
        signature: 'str_trim(s)',
        description: 'Removes leading and trailing whitespace.',
        parameters: [{ label: 's', description: 'The string to trim.' }]
    },

    // arr
    arr_length: {
        name: 'arr_length',
        signature: 'arr_length(a)',
        description: 'Returns the number of items in the array.',
        parameters: [{ label: 'a', description: 'The target array.' }]
    },
    arr_get: {
        name: 'arr_get',
        signature: 'arr_get(a, index)',
        description: 'Returns the item at the specified index or Void if out of bounds.',
        parameters: [
            { label: 'a', description: 'The target array.' },
            { label: 'index', description: 'The numeric index to retrieve.' }
        ]
    },
    arr_push: {
        name: 'arr_push',
        signature: 'arr_push(a, item)',
        description: 'Appends an item to the array (In-place mutation).',
        parameters: [
            { label: 'a', description: 'The target array.' },
            { label: 'item', description: 'The value to append.' }
        ]
    },
    arr_pop: {
        name: 'arr_pop',
        signature: 'arr_pop(a)',
        description: 'Removes and returns the last item of the array.',
        parameters: [{ label: 'a', description: 'The target array.' }]
    },
    arr_each: {
        name: 'arr_each',
        signature: 'arr_each(a, callback_task)',
        description: 'Iterates over a snapshot of the array. Callback receives (item, index).',
        parameters: [
            { label: 'a', description: 'The target array.' },
            { label: 'callback_task', description: 'A Task that receives (item, ?index).' }
        ]
    },

    // map
    map_get: {
        name: 'map_get',
        signature: 'map_get(m, key)',
        description: 'Returns the value for the string key, or Void.',
        parameters: [
            { label: 'm', description: 'The target map.' },
            { label: 'key', description: 'The string key to look up.' }
        ]
    },
    map_set: {
        name: 'map_set',
        signature: 'map_set(m, key, val)',
        description: 'Updates a key-value pair in the map (In-place mutation).',
        parameters: [
            { label: 'm', description: 'The target map.' },
            { label: 'key', description: 'The string key.' },
            { label: 'val', description: 'The value to assign.' }
        ]
    },
    map_keys: {
        name: 'map_keys',
        signature: 'map_keys(m)',
        description: 'Returns an array of all keys in the map.',
        parameters: [{ label: 'm', description: 'The target map.' }]
    },

    // math
    math_add: {
        name: 'math_add',
        signature: 'math_add(...nums)',
        description: 'Returns the sum of all arguments.',
        parameters: [{ label: '...nums', description: 'Numbers to add.' }]
    },
    math_sub: {
        name: 'math_sub',
        signature: 'math_sub(a, b)',
        description: 'Returns the difference (a - b).',
        parameters: [
            { label: 'a', description: 'Initial value.' },
            { label: 'b', description: 'Value to subtract.' }
        ]
    },
    math_mul: {
        name: 'math_mul',
        signature: 'math_mul(...nums)',
        description: 'Returns the product of all arguments.',
        parameters: [{ label: '...nums', description: 'Numbers to multiply.' }]
    },
    math_div: {
        name: 'math_div',
        signature: 'math_div(a, b)',
        description: 'Returns the quotient (a / b).',
        parameters: [
            { label: 'a', description: 'Dividend.' },
            { label: 'b', description: 'Divisor.' }
        ]
    },
    math_gt: {
        name: 'math_gt',
        signature: 'math_gt(a, b)',
        description: 'Returns 1 if a > b, else Void.',
        parameters: [
            { label: 'a', description: 'First value.' },
            { label: 'b', description: 'Second value.' }
        ]
    },
    math_lt: {
        name: 'math_lt',
        signature: 'math_lt(a, b)',
        description: 'Returns 1 if a < b, else Void.',
        parameters: [
            { label: 'a', description: 'First value.' },
            { label: 'b', description: 'Second value.' }
        ]
    },
    math_eq: {
        name: 'math_eq',
        signature: 'math_eq(a, b)',
        description: 'Returns 1 if values are deeply equal, else Void.',
        parameters: [
            { label: 'a', description: 'First value.' },
            { label: 'b', description: 'Second value.' }
        ]
    },

    // logic
    logic_and: {
        name: 'logic_and',
        signature: 'logic_and(...args)',
        description: 'Returns the last arg if all are truthy, else Void.',
        parameters: [{ label: '...args', description: 'Values to evaluate.' }]
    },
    logic_or: {
        name: 'logic_or',
        signature: 'logic_or(...args)',
        description: 'Returns the first truthy arg, else Void.',
        parameters: [{ label: '...args', description: 'Values to evaluate.' }]
    },
    logic_eq: {
        name: 'logic_eq',
        signature: 'logic_eq(a, b)',
        description: 'Returns 1 if values are deeply equal, else Void.',
        parameters: [
            { label: 'a', description: 'First value.' },
            { label: 'b', description: 'Second value.' }
        ]
    },

    // regex
    regex_parse: {
        name: 'regex_parse',
        signature: 'regex_parse(pattern, ?flags)',
        description: 'Compiles a raw string pattern into an Opaque (RegExp) handle.',
        parameters: [
            { label: 'pattern', description: 'Regex pattern string.' },
            { label: 'flags', description: 'Optional flags (e.g., "i", "g").' }
        ]
    },
    regex_match: {
        name: 'regex_match',
        signature: 'regex_match(s, pattern)',
        description: 'Returns 1 if the string matches the pattern, else Void.',
        parameters: [
            { label: 's', description: 'The string to test.' },
            { label: 'pattern', description: 'The pattern (Opaque or string).' }
        ]
    },
    regex_replace: {
        name: 'regex_replace',
        signature: 'regex_replace(s, pattern, repl)',
        description: 'Returns a new string with occurrences of pattern replaced by repl.',
        parameters: [
            { label: 's', description: 'Target string.' },
            { label: 'pattern', description: 'The pattern to search for.' },
            { label: 'repl', description: 'The replacement string.' }
        ]
    },

    // err
    err_code: {
        name: 'err_code',
        signature: 'err_code(e)',
        description: 'Returns the numeric code of the error.',
        parameters: [{ label: 'e', description: 'The native Error object.' }]
    },
    err_message: {
        name: 'err_message',
        signature: 'err_message(e)',
        description: 'Returns the localized error message.',
        parameters: [{ label: 'e', description: 'The native Error object.' }]
    },
    err_args: {
        name: 'err_args',
        signature: 'err_args(e)',
        description: 'Returns the Array of raw context values associated with the error.',
        parameters: [{ label: 'e', description: 'The native Error object.' }]
    },
    err_isError: {
        name: 'err_isError',
        signature: 'err_isError(val)',
        description: 'Returns 1 if the value is of type Error.',
        parameters: [{ label: 'val', description: 'The value to check.' }]
    },

    // json
    json_parse: {
        name: 'json_parse',
        signature: 'json_parse(s)',
        description: 'Converts a JSON string into Hank data structures.',
        parameters: [{ label: 's', description: 'JSON string.' }]
    },
    json_stringify: {
        name: 'json_stringify',
        signature: 'json_stringify(val)',
        description: 'Converts Hank data into a JSON string.',
        parameters: [{ label: 'val', description: 'Hank value to serialize.' }]
    }
};
