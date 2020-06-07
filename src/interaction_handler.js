/* Copyright (c) 2020, Piet Hein Schouten. All rights reserved.
 * Licensed under the terms of the MIT license.
 */
const CLICK_EVENT_TYPE = 'click';
const MOUSE_DOWN_EVENT_TYPE = 'mousedown';
const MOUSE_MOVE_EVENT_TYPE = 'mousemove';
const MOUSE_UP_EVENT_TYPE = 'mouseup';
const CONTEXT_MENU_EVENT_TYPE = 'contextmenu';

var listeners = {};
listeners[CLICK_EVENT_TYPE] = null;
listeners[MOUSE_DOWN_EVENT_TYPE] = null;
listeners[MOUSE_MOVE_EVENT_TYPE] = null;
listeners[MOUSE_UP_EVENT_TYPE] = null;
listeners[CONTEXT_MENU_EVENT_TYPE] = null;


function attachEventHandlers(cg)
{
    var trackingMouse = false;

    var pt = cg.createSVGPoint();

    var convertToPoint = evt => {
        pt.x = evt.clientX;
        pt.y = evt.clientY;

        // The cursor point, translated into svg coordinates
        var cursorpt =  pt.matrixTransform(cg.getTransformMatrix().inverse());

        var x = Math.round(cursorpt.x * 100.0) / 100.0;
        var y = Math.round(cursorpt.y * 100.0) / 100.0;
        return [x, y];
    };

    cg.addEventListener('click', function(evt) {
        evt.preventDefault();
        if (listeners[CLICK_EVENT_TYPE])
            listeners[CLICK_EVENT_TYPE](convertToPoint(evt));
    });

    cg.addEventListener('mousedown', function(evt) {
        if (evt.button == 0)
        {
            evt.preventDefault();
            if (listeners[MOUSE_DOWN_EVENT_TYPE])
                listeners[MOUSE_DOWN_EVENT_TYPE](convertToPoint(evt));

            trackingMouse = true;
        }
    });

    cg.addEventListener('mouseup', function(evt) {
        if (evt.button == 0)
        {
            evt.preventDefault();
            if (listeners[MOUSE_UP_EVENT_TYPE])
                listeners[MOUSE_UP_EVENT_TYPE](convertToPoint(evt));

            trackingMouse = false;
        }
    });

    cg.addEventListener('mousemove', function(evt) {
        evt.preventDefault();
        if (listeners[MOUSE_MOVE_EVENT_TYPE] && trackingMouse)
            listeners[MOUSE_MOVE_EVENT_TYPE](convertToPoint(evt));
    });

    cg.addEventListener('contextmenu', function(evt) {
        evt.preventDefault();
        if (listeners[CONTEXT_MENU_EVENT_TYPE])
            listeners[CONTEXT_MENU_EVENT_TYPE](convertToPoint(evt));
    });
}

function setEventListener(eventType, callback)
{
    if (listeners.hasOwnProperty(eventType))
    {
        listeners[eventType] = callback;
    }
}

export const InteractionHandler = {
    attachEventHandlers: function(cg)
    {
        attachEventHandlers(cg);
    },
    setEventListener: function(eventType, callback)
    {
        setEventListener(eventType, callback);
    }
};

