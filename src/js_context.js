/* Copyright (c) 2019, Piet Hein Schouten. All rights reserved.
 * Licensed under the terms of the MIT license.
 */
export const jsContextFactory = {
    newContext: function() { return new JSContext(); }
};


function JSContext()
{
    let constLocals = {};

    this.addConstLocal = function(name, value)
    {
        constLocals[name] = value;
    }

    this.execute = function(code)
    {
        return execute(constLocals, code);
    }
}


function execute(constLocals, code)
{
    let executed = false;

    let locals = [];
    let localsCode = "";

    for (const local in constLocals)
    {
        localsCode += `const ${local}=__loc[${locals.length}];`;
        locals.push(constLocals[local]);
    }

    code = `'use strict';${localsCode}${code}`;

    try
    {
        let func = new Function('__loc', code);
        func(locals);
        executed = true;
    }
    catch(error)
    {
        console.log(error);
    }

    return executed;
}

