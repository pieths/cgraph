/* Copyright (c) 2020, Piet Hein Schouten. All rights reserved.
 * Licensed under the terms of the MIT license.
 */
import {Smooth} from './smooth-0.1.7.js';
import {graphUtils} from './graph_utils.js';
import {jsContextFactory} from './js_context.js';
import {
    getNearestValue,
    roundToNearestMultiple,
    parseFloats,
    isFloat,
    createSvgElement,
    setAttributes
} from './utils.js';


export const CommandsApi = function(cgInstance)
{
    for (const commandName in commands)
    {
        Object.defineProperty(this, commandName, {
            writable: false,
            value: (args={}) => {return commands[commandName].func(cgInstance, args)}
        });
    }
}


function getFloatValueFromArgs(args, argName, defaultValue)
{
    var value = 1.0;
    if (defaultValue === undefined) defaultValue = 1.0;

    if (args.hasOwnProperty(argName))
    {
        value = parseFloat(args[argName][0]);
        value = Number.isNaN(value) ? defaultValue : value;
    }
    else
    {
        value = defaultValue;
    }

    return value;
}


function parseTransformArg(arg)
{
    var result = "";
    var transform = "";
    var parameters = [];
    var parts = arg.split(/\s+/);

    var appendTransform = () => {
        if ((transform !== "") && (parameters.length > 0))
        {
            result += transform + "(" + parameters.join(',') + ") ";
        }
    };

    for (var i=0; i < parts.length; i++)
    {
        var part = parts[i];

        if (Number.isNaN(parseFloat(part)))
        {
            appendTransform();
            transform = "";
            parameters = [];

            if (part == 's') transform = "scale";
            else if (part == 'r') transform = "rotate";
            else if (part == 't') transform = "translate";
        }
        else
        {
            parameters.push(part);
        }
    }

    appendTransform();
    return result;
}


function extractAttributesFromArgs(args, params)
{
    var attributes = {};

    for (const argName in args)
    {
        if (params.hasOwnProperty(argName))
        {
            let param = params[argName];
            if (param.isAttribute)
            {
                //attributes[param.name] = args[argName].join(" ");
                attributes[param.name] = args[argName]
            }
        }
    }

    return attributes;
}


function getTransformedUrl(url)
{
    if (url.startsWith("@"))
    {
        var key = url.substring(1);

        url = urlMap.hasOwnProperty(key) ?
              urlMap[key] : "#";
    }

    return url;
}


let commands = {};

commands['init'] = {};
commands['init'].params =
{
    w: {name: "width", isAttribute: true},
    h: {name: "height", isAttribute: true},
    r: {name: "range", isAttribute: false},
    bo: {name: "border", isAttribute: false},
    pad: {name: "padding", isAttribute: false},
    fss: {name: "font-and-stroke-scale", isAttribute: false}
};
commands['init'].func = function(cg, args)
{
    if (args.hasOwnProperty('r')) cg.graphRange.update(args['r']);

    let attributes = extractAttributesFromArgs(args, this.params);

    if (!attributes.hasOwnProperty('width') &&
        !attributes.hasOwnProperty('height'))
    {
        attributes['width'] = "30em";
    }

    if ( attributes.hasOwnProperty('width') &&
        !attributes.hasOwnProperty('height'))
    {
        /*
         * If only the width is defined, then set
         * the height so that the width to height
         * ratio matches that of the graph range.
         */

        let match = attributes['width'].match(/^((?:[0-9]*[.])?[0-9]+)(\D*)$/);
        if (match)
        {
            let value = parseFloat(match[1]);
            if (!Number.isNaN(value))
            {
                let height = value * (cg.graphRange.yrange / cg.graphRange.xrange);
                attributes['height'] = height.toString();
                if (match.length == 3) attributes['height'] += match[2];
            }
        }
    }
    else if (!attributes.hasOwnProperty('width') &&
              attributes.hasOwnProperty('height'))
    {
        /*
         * If only the height is defined, then set
         * the width so that the width to height
         * ratio matches that of the graph range.
         */

        let match = attributes['height'].match(/^((?:[0-9]*[.])?[0-9]+)(\D*)$/);
        if (match)
        {
            let value = parseFloat(match[1]);
            if (!Number.isNaN(value))
            {
                let width = value * (cg.graphRange.xrange / cg.graphRange.yrange);
                attributes['width'] = width.toString();
                if (match.length == 3) attributes['width'] += match[2];
            }
        }
    }

    let style = "";

    if (args.hasOwnProperty('bo'))
    {
        let border = args['bo'];
        let type = typeof(border);

        if (type == "number")
        {
            style += `border:${border}px solid #00000033;`;
        }
        else if (type == "string")
        {
            if (/^([0-9]*[.])?[0-9]+$/.test(border))
            {
                border += "px solid #00000033";
            }

            style += `border:${border};`;
        }
    }

    if (args.hasOwnProperty('pad'))
    {
        let padding = args['pad'];
        let type = typeof(padding);
        
        if (type == "number")
        {
            style += `padding:${padding}px;`;
        }
        else if (type == "string")
        {
            if (/^([0-9]*[.])?[0-9]+$/.test(padding))
            {
                padding += "px";
            }

            style += `padding:${padding};`;
        }
    }

    if (style != "")
    {
        attributes['style'] = style;
    }

    var scale = 1.0;
    if (args.hasOwnProperty('fss')) scale = args['fss'];

    /*
     * Width, height and graphRange must be set before
     * initRootElements so that initRootElements can
     * compute the scale properly when using uniform scaling.
     */
    cg.initRootElements(attributes, scale);

    return {
        // TODO: the width and height here should be numbers?
        get w() { return attributes['width']; },
        get h() { return attributes['height']; },
        get fss() { return cg.getScale(); },
        get name() { return 'init'; }
    };
};


commands['grid'] = {};
commands['grid'].params =
{
    r: {name: "range", numValues: 4, isAttribute: false},
    sp: {name: "spacing", numValues: 2, isAttribute: false},
    sc: {name: "stroke", numValues: 1, isAttribute: true},
    sw: {name: "stroke-width", numValues: 1, isAttribute: true},
    so: {name: "stroke-opacity", numValues: 1, isAttribute: true},
    sda: {name: "stroke-dasharray", numValues: 1, isAttribute: true},
    o: {name: "opacity", numValues: 1, isAttribute: true}
};
commands['grid'].func = function(cg, args)
{
    var xMin = cg.graphRange.xmin;
    var yMin = cg.graphRange.ymin;
    var xMax = cg.graphRange.xmax;
    var yMax = cg.graphRange.ymax;

    if (args.hasOwnProperty('r'))
    {
        [xMin, yMin, xMax, yMax] = args['r'];
    }

    var xSpacing = 10;
    var ySpacing = 10;

    if (args.hasOwnProperty('sp'))
    {
        [xSpacing, ySpacing] = args['sp'];
    }
    else
    {
        /*
         * Default spacing divides up the full
         * range in to common divisions.
         */
        var defaultSpacings = [0.001, 0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 25, 50, 100];

        var xSpacing = getNearestValue((xMax - xMin) / 10.0, defaultSpacings);
        var ySpacing = getNearestValue((yMax - yMin) / 10.0, defaultSpacings);
    }

    let xStart = roundToNearestMultiple(xMin, xSpacing);
    let yStart = roundToNearestMultiple(yMin, ySpacing);

    var pathDString = "";

    for (var x=xStart; x <= xMax; x += xSpacing)
    {
        pathDString += `M ${x} ${yMin} V ${yMax} `;
    }

    for (var y=yStart; y <= yMax; y += ySpacing)
    {
        pathDString += `M ${xMin} ${y} H ${xMax} `;
    }

    var attributes = extractAttributesFromArgs(args, this.params);
    attributes['d'] = pathDString;

    if (!args.hasOwnProperty('sw')) attributes['stroke-width'] = "0.5";
    if (!args.hasOwnProperty('so')) attributes['stroke-opacity'] = "0.2";

    var pathElement = createSvgElement('path', true);

    setAttributes(pathElement, attributes);
    cg.appendElement(pathElement);

    return {};
};


commands['axis'] = {};
commands['axis'].params =
{
    r: {name: "range", numValues: 4, isAttribute: false},
    sc: {name: "stroke", numValues: 1, isAttribute: true},
    sw: {name: "stroke-width", numValues: 1, isAttribute: true},
    so: {name: "stroke-opacity", numValues: 1, isAttribute: true},
    sda: {name: "stroke-dasharray", numValues: 1, isAttribute: true},
    o: {name: "opacity", numValues: 1, isAttribute: true}
};
commands['axis'].func = function(cg, args)
{
    var xMin = cg.graphRange.xmin;
    var yMin = cg.graphRange.ymin;
    var xMax = cg.graphRange.xmax;
    var yMax = cg.graphRange.ymax;

    if (args.hasOwnProperty('r'))
    {
        [xMin, yMin, xMax, yMax] = args['r'];
    }

    var attributes = extractAttributesFromArgs(args, this.params);
    attributes['marker-start'] = `url(#${cg.arrowHeadStartMarkerId})`;
    attributes['marker-end'] = `url(#${cg.arrowHeadEndMarkerId})`;

    if (!args.hasOwnProperty('sw')) attributes['stroke-width'] = "1";
    if (!args.hasOwnProperty('so')) attributes['stroke-opacity'] = "0.6";

    let xPathElement = createSvgElement('path', true);

    attributes['d'] = `M ${xMin} 0 H ${xMax}`;
    setAttributes(xPathElement, attributes);

    let yPathElement = createSvgElement('path', true);

    attributes['d'] = `M 0 ${yMin} V ${yMax}`;
    setAttributes(yPathElement, attributes);

    cg.appendElement(xPathElement);
    cg.appendElement(yPathElement);

    return {};
};


commands['point'] = {};
commands['point'].params =
{
    id:  {name: "name", isAttribute: false},
    p:   {name: "point", isAttribute: false},
    r:   {name: "r", isAttribute: true},
    sc:  {name: "stroke", isAttribute: true},
    sw:  {name: "stroke-width", isAttribute: true},
    so:  {name: "stroke-opacity", isAttribute: true},
    sda: {name: "stroke-dasharray", isAttribute: true},
    f:   {name: "fill", isAttribute: true},
    fo:  {name: "fill-opacity", isAttribute: true},
    o:   {name: "opacity", isAttribute: true}
};
commands['point'].func = function(cg, args)
{
    var newElement = createSvgElement('circle', true);
    var attributes = extractAttributesFromArgs(args, this.params);

    let x = 0;
    let y = 0;

    if (args.hasOwnProperty('p'))
    {
        let value = args['p'];
        if (value instanceof graphUtils.Point)
        {
            x = value.x;
            y = value.y;
        }
        else
        {
            x = args['p'][0];
            y = args['p'][1];
        }
    }

    attributes['cx'] = x;
    attributes['cy'] = y;

    if (!attributes.hasOwnProperty('stroke-width')) attributes['stroke-width'] = 0;
    if (!attributes.hasOwnProperty('fill')) attributes['fill'] = "#000";

    if (!attributes.hasOwnProperty('r')) attributes['r'] = 3 * cg.getScale();
    else
    {
        let radius = attributes['r'];
        if (!Number.isNaN(radius)) radius *= cg.getScale();
        attributes['r'] = radius;
    }

    setAttributes(newElement, attributes);
    cg.appendElement(newElement); 

    let point = new graphUtils.Point(x, y);
    return {
        get p() { return point; }
    };
};

