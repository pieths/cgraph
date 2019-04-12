/* Copyright (c) 2019, Piet Hein Schouten. All rights reserved.
 * Licensed under the terms of the MIT license.
 */
var numErrors = 0;
var loggerOutputContainer = document.getElementById("loggerOutputContainer");


export const logger =
{
    log: message => {
        let element = document.createElement('pre');
        var textNode = document.createTextNode(message);
        element.appendChild(textNode);
        element.setAttribute('class', 'logger-log');
        loggerOutputContainer.append(element);
    },

    error: message => {
        let element = document.createElement('pre');
        var textNode = document.createTextNode(message);
        element.appendChild(textNode);
        element.setAttribute('class', 'logger-error');
        loggerOutputContainer.append(element);

        numErrors++;
    },

    numErrors: () => numErrors,
};

