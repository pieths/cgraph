/* Copyright (c) 2020, Piet Hein Schouten. All rights reserved.
 * Licensed under the terms of the MIT license.
 */
import {CommandsApi} from './command_lib.js';
import {jsContextFactory} from './js_context.js';
import {roundToNearestMultiple, parseFloats, createSvgElement, setAttributes} from './utils.js';
import {Cache} from './cache.js';
import {InteractionHandler} from './interaction_handler.js';
import {graphUtils} from './graph_utils.js';


const majorVersion = 1;
const minorVersion = 0;

var options =
{
    defaultStrokeWidth: 1,
    defaultFontSize: 16,
    test: true
};

var uniqueIdCounter = 0;

var urlMap = {};


function setUrlMap(map)
{
    if (typeof map == "object") urlMap = map;
}


function getUniqueId()
{
    return "cgraph_id_" + uniqueIdCounter++;
}


function logError(errorString)
{
    console.error("CGraph: Error: " + errorString);
};


const GraphRange = (function() {
    function GraphRange()
    {
        this.xmin = -100;
        this.xmax =  100;
        this.ymin = -100;
        this.ymax =  100;
        this.xrange = 200;
        this.yrange = 200;

        this.update = function(inputValues)
        {
            var values = [];
            if (parseFloats(inputValues, values))
            {
                this.xmin = values[0];
                this.ymin = values[1];
                this.xmax = values[2];
                this.ymax = values[3];
            }

            if (this.xmin >= this.xmax)
            {
                this.xmin = -100;
                this.xmax =  100;
            }

            if (this.ymin >= this.ymax)
            {
                this.ymin = -100;
                this.ymax =  100;
            }

            this.xrange = this.xmax - this.xmin;
            this.yrange = this.ymax - this.ymin;
        }
    }

    return GraphRange;
})();


function CGInstance()
{
    /*
     * A per graph prefix to be used for unique ids.
     */
    const idPrefix = getUniqueId() + "_";

    const arrowHeadStartMarkerId = getId("arrow_start");
    const arrowHeadEndMarkerId = getId("arrow_end");

    var _scale = 1.0; // TODO: should this be renamed

    const graphRange = new GraphRange();

    const svgElement = createSvgElement('svg', true);
    const parentElementStack = [svgElement];

    var useUniformScaling = false;
    var showUniformScale = false;


    function getId(suffix)
    {
        return idPrefix + suffix;
    }


    function appendDefaultMarkers(rootElement)
    {
        var defsElement = createSvgElement('defs', {});

        /*
         * Markers are defined so that their positive X axis gets
         * rotated to point along the direction the path travels.
         */

        var arrowHeadEndMarkerElement = createSvgElement('marker', {
            id: arrowHeadEndMarkerId, viewBox: "0 0 10 10",
            refX: 10, refY: 5, markerWidth: 6, markerHeight: 6,
            orient: 'auto', markerUnits: 'strokeWidth'
        });

        var pathElement = createSvgElement('path', {d: "M 0 0 L 10 4 L 10 6 L 0 10 z"});

        arrowHeadEndMarkerElement.appendChild(pathElement);
        defsElement.appendChild(arrowHeadEndMarkerElement);


        var arrowHeadStartMarkerElement = createSvgElement('marker', {
            id: arrowHeadStartMarkerId, viewBox: "0 0 10 10",
            refX: 0, refY: 5, markerWidth: 6, markerHeight: 6,
            orient: 'auto', markerUnits: 'strokeWidth'
        });

        pathElement = createSvgElement('path', {d: "M 10 0 L 0 4 L 0 6 L 10 10 z"});

        arrowHeadStartMarkerElement.appendChild(pathElement);
        defsElement.appendChild(arrowHeadStartMarkerElement);

        rootElement.appendChild(defsElement);
    }


    function appendElement(element, isNewParent)
    {
        var parentElement = parentElementStack[parentElementStack.length - 1];
        parentElement.appendChild(element);

        if (isNewParent && (element.tagName.toLowerCase() == 'g'))
        {
            /*
             * Make sure that the stroke-width attribute is explicitly
             * set so that the scaling which is applied works correctly.
             */

            var dataAttributeName = 'data-cgraph-prescaled-stroke-width';

            if (!element.hasAttribute('stroke-width'))
            {
                var value = (parentElement.hasAttribute(dataAttributeName)) ?
                             parentElement.getAttribute(dataAttributeName) :
                             options.defaultStrokeWidth.toString();

                element.setAttribute('stroke-width', value);
            }

            /*
             * Save the prescaled stroke width so that it can be referenced
             * by g elements which are children of this one.
             */
            element.setAttribute(dataAttributeName, element.getAttribute('stroke-width'));

            if (useUniformScaling && (parentElementStack.length == 1))
            {
                let ctm = element.getScreenCTM();
                _scale = 1.0 / Math.sqrt((ctm.a*ctm.a) + (ctm.b*ctm.b));

                if (showUniformScale)
                {
                    let textContent = 'CGraph: fss = ' + roundToNearestMultiple(_scale, 0.0001);

                    let scaleTextElement = document.createElement('div');
                    scaleTextElement.setAttribute('class', 'cgraph-uniform-scale-notification');
                    scaleTextElement.appendChild(document.createTextNode(textContent));

                    svgElement.parentElement.insertBefore(scaleTextElement, svgElement);
                }
            }

            parentElementStack.push(element);
        }


        if (element.hasAttribute('stroke-width'))
        {
            var strokeWidth = parseFloat(element.getAttribute('stroke-width'));
            strokeWidth *= _scale;
            element.setAttribute('stroke-width', strokeWidth);
        }
    }


    function setScale(scale)
    {
        if (scale === "u")
        {
            useUniformScaling = true;
        }
        else if (scale === "?")
        {
            useUniformScaling = true;
            showUniformScale = true;
        }
        else
        {
            if (typeof scale == "string")
            {
                scale = parseFloat(scale);
                if (!Number.isNaN(scale)) _scale = scale;
            }
            else if (typeof scale == "number")
            {
                _scale = scale;
            }

            useUniformScaling = false;
        }
    }


    function initRootElements(attributes, scale)
    {
        if (scale !== undefined) setScale(scale);

        setAttributes(svgElement, attributes);

        setAttributes(svgElement, {
            'viewBox': [0, 0, graphRange.xrange, graphRange.yrange].join(" "),
            'preserveAspectRatio': 'xMinYMin'
        });

        attributes =
        {
            'stroke': "#000",
            'stroke-opacity': "1",
            'stroke-width': options.defaultStrokeWidth.toString(),
            'font-size': options.defaultFontSize.toString(),
            'fill': "none"
        };

        var xTranslate = -1 * graphRange.xmin;
        var yTranslate = graphRange.ymax;
        var attributeValue = "translate(" + xTranslate + "," + yTranslate + ") scale(1,-1)";
        attributes['transform'] = attributeValue;

        var gElement = createSvgElement("g", attributes);
        appendElement(gElement, true);
    };


    function drawRoundedAngleMarker(points, radius)
    {
        /*
         * NOTE: the points need to be defined
         * in a counter clockwise manner.
         */

        var p2 = points[1];

        // Translate point so that p2 is at the origin
        var translate = (p) => [ p[0] + -1*p2[0], p[1] + -1*p2[1] ];
        var p1 = translate(points[0]);
        var p3 = translate(points[2]);

        var scaleFactor = radius / Math.hypot(p3[0], p3[1]);
        var arcStart = [ scaleFactor * p3[0], scaleFactor * p3[1] ];

        var scaleFactor = radius / Math.hypot(p1[0], p1[1]);
        var arcEnd = [ scaleFactor * p1[0], scaleFactor * p1[1] ];

        // Translate back to original coordinate system
        translate = (p) => { p[0] += p2[0]; p[1] += p2[1] };
        translate(arcStart);
        translate(arcEnd);

        var newElement = createSvgElement('path', true);

        var d = `M ${arcStart[0]} ${arcStart[1]} A ${radius} ${radius} 0 0 1 ${arcEnd[0]} ${arcEnd[1]}`;

        setAttributes(newElement, {'d': d});
        appendElement(newElement);
    }


    function drawSquareAngleMarker(points, radius)
    {
        var p2 = points[1];

        // Translate points so that p2 is at the origin
        var translate = (p) => [ p[0] + -1*p2[0], p[1] + -1*p2[1] ];
        var p1 = translate(points[0]);
        var p3 = translate(points[2]);

        var scaleFactor = radius / Math.hypot(p3[0], p3[1]);
        var startPoint = [ scaleFactor * p3[0], scaleFactor * p3[1] ];

        scaleFactor = radius / Math.hypot(p1[0], p1[1]);
        var endPoint = [ scaleFactor * p1[0], scaleFactor * p1[1] ];

        var midPoint = [ 0.5 * (startPoint[0] + endPoint[0]),
                         0.5 * (startPoint[1] + endPoint[1])];
        scaleFactor = (Math.SQRT2 * radius) / Math.hypot(midPoint[0], midPoint[1]);
        midPoint = [ scaleFactor * midPoint[0], scaleFactor * midPoint[1] ];


        // Translate back to original coordinate system
        translate = (p) => { p[0] += p2[0]; p[1] += p2[1] };
        translate(startPoint);
        translate(endPoint);
        translate(midPoint);

        var newElement = createSvgElement('path', true);

        var d = `M ${startPoint[0]} ${startPoint[1]} L ${midPoint[0]} ${midPoint[1]} L ${endPoint[0]} ${endPoint[1]}`;

        setAttributes(newElement, {'d': d});
        appendElement(newElement);
    }


    function drawAngleMarkers(points, style, scale)
    {
        if (scale === undefined)
        {
            scale = 1.0;
        }

        var radii = [10, 13, 16].map(i => scale * i);

        if (style == ")")
        {
            drawRoundedAngleMarker(points, radii[0]);
        }
        else if (style == "))")
        {
            drawRoundedAngleMarker(points, radii[0]);
            drawRoundedAngleMarker(points, radii[1]);
        }
        else if (style == ")))")
        {
            drawRoundedAngleMarker(points, radii[0]);
            drawRoundedAngleMarker(points, radii[1]);
            drawRoundedAngleMarker(points, radii[2]);
        }
        else if (style == "r")
        {
            drawSquareAngleMarker(points, radii[0]);
        }
    }


    function popParentElement()
    {
        /*
         * Do not allow popping the first two elements off
         * the stack since they are required for proper coordinates.
         */
        if (parentElementStack.length > 2)
        {
            var topElement = parentElementStack[parentElementStack.length - 1];
            if (topElement.nodeName == 'g')
            {
                parentElementStack.pop();
            }
        }
    }

    setAttributes(svgElement, {'class': 'cgraph-root'});
    appendDefaultMarkers(svgElement);

    /*
     * Set public api.
     */
    this.getId = getId;
    this.appendElement = appendElement;
    this.graphRange = graphRange;
    this.initRootElements = initRootElements;
    this.drawAngleMarkers = drawAngleMarkers;
    this.popParentElement = popParentElement;
    this.arrowHeadStartMarkerId = arrowHeadStartMarkerId;
    this.arrowHeadEndMarkerId = arrowHeadEndMarkerId;
    this.getRootElement = function() { return svgElement; }
    this.getTransformMatrix = function() { return parentElementStack[1].getScreenCTM(); }
    this.getScale = function() { return _scale; }
    this.createSVGPoint = function() { return svgElement.createSVGPoint(); }
    this.addEventListener = function(e, f) { svgElement.addEventListener(e, f); }
};


function processElement(sourceElement)
{
    var cg = new CGInstance();
    var svgElement = cg.getRootElement();

    sourceElement.parentElement.insertBefore(svgElement, sourceElement);
    sourceElement.parentNode.removeChild(sourceElement);

    /*
     * Using innerHTML here does not work correctly because
     * the returned text contains html entities like: &gt; and &lt;
     * which do not get handled correctly when evaluating javascript.
     * Furthermore, the input is parsed after inserting the SVG element
     * into the dom tree so that the getScreenCTM call returns valid
     * information for width and height properties.
     */
    var sourceText = sourceElement.textContent;

    var cachedValue = Cache.get(sourceText);

    if (cachedValue === null)
    {
        const jsContext = jsContextFactory.newContext();
        jsContext.addConstLocal('M', Math);
        jsContext.addConstLocal('P', (x, y) => new graphUtils.Point(x, y));
        jsContext.addConstLocal('B', (x, y, width, height) => new graphUtils.Bounds(x, y, width, height));
        jsContext.addConstLocal('cg', new CommandsApi(cg));
        jsContext.execute(sourceText)

        if (Cache.enabled()) Cache.put(sourceText, svgElement);
    }
    else
    {
        /*
         * Replace the current svg element with the cached one.
         */
        svgElement.parentElement.insertBefore(cachedValue, svgElement);
        svgElement.parentNode.removeChild(svgElement);
    }

    InteractionHandler.attachEventHandlers(cg);
    return cg;
}


function convertToShrinkableWidth(cg)
{
    var element = cg.getRootElement();

    if (element.hasAttribute('width'))
    {
        let width = element.getAttribute('width').trim();

        if (width.length == 0) return false;
        if (width.endsWith('%')) return true;

        element.setAttribute('width', '80%');

        let style = element.hasAttribute('style') ?
                    element.getAttribute('style') : "";

        style += `max-width: ${width};`;
        element.setAttribute('style', style);

        element.removeAttribute('height');
        return true;
    }

    return false;
}


function convertElement(element, options)
{
    var converted = false;
    var attributeName = "data-content-type";

    if (element.hasAttribute(attributeName))
    {
        var contentType = element.getAttribute(attributeName);

        var regexResult = contentType.match(/^cgraph_(\d+)$/);
        if (regexResult !== null)
        {
            var version = regexResult[1];

            if (parseInt(version) === majorVersion)
            {
                let cg = processElement(element);

                if (options && options.shrinkable)
                    convertToShrinkableWidth(cg);

                converted = true;
            }
            else logError("Unsupported version: " + version);
        }
        else logError(`Invalid ${attributeName} value.`);
    }
    else logError(`Element missing ${attributeName} attribute.`);

    return converted;
};


function convertAllElements(options)
{
    var elements = document.querySelectorAll("div[data-content-type^='cgraph_']");
    elements.forEach(element => convertElement(element, options));
};


function convertDescendents(parentElement, options)
{
    var elements = parentElement.querySelectorAll("div[data-content-type^='cgraph_']");
    elements.forEach(element => convertElement(element, options));
}


function getTestObject()
{
    let testObject = {};

    /*
    if (options.test)
    {
        testObject.parser = parser;
    }
    */

    return testObject;
}


export const CGraph = {
    setUrlMap: function(map)
    {
        setUrlMap(map);
    },
    enableCache: function(enable)
    {
        Cache.enable(enable);
    },
    convertElement: function(element, options)
    {
        convertElement(element, options);
    },
    convertAllElements: function(options)
    {
        convertAllElements(options);
    },
    convertDescendents: function(parentElement, options)
    {
        convertDescendents(parentElement, options);
    },
    setEventListener: function(eventType, callback)
    {
        InteractionHandler.setEventListener(eventType, callback);
    },
    getTestObject: function()
    {
        return getTestObject();
    }
};

