/* Copyright (c) 2019, Piet Hein Schouten. All rights reserved.
 * Licensed under the terms of the MIT license.
 */
import {CGraph} from '../src/cgraph.js';


var presets = {};

const defaultPresets =
{
'Basic Shapes And Commands':
`init w 30em r -10 -10 150 100 fss 0.333; grid; axis;

point p 10 90
text p 10 80 t "Point" ha c

points p (40 93 45 95 35 93)
text p 40 80 t "Points" ha c

circle c 70 93 r 3
text p 70 80 t "Circle" ha c

ellipse b 95 90 10 5
text p 100 80 t "Ellipse" ha c

line p 125 90 135 97
text p 130 80 t "Line" ha c

path d (M 10 50 l 5 0 l 0 5 l 5 0 l 0 -5 l 5 0)
text p 17 40 t "Path" ha c

rect b 40 50 20 10
text p 50 40 t "Rect" ha c

arrow p 75 50 100 55
text p 89 40 t "Arrow" ha c

triangle p 116 50 140 50 140 60
text p 129 40 t "Triangle" ha c

setblob b 5 15 20 10
text p 15 7 t "Set Blob" ha c

brace p 40 15 60 15 50 20
text p 50 7 t "Brace" ha c

curve p ( 70 15 77 15 80 18 81 22 83.5 23 86 22 89 17 96 15)
text p 84 7 t "Curve" ha c

img x 110 y 30 w 30 h 15 url feynmann.svg
text p 124 7 t "Image" ha c`,

/*******************************************/

'Simple Text Inside A Box':
`init w 30em r -10 -10 150 100 fss 0.333; grid; axis;

# Modify this point to change the location of the rect
$p=P(71, 32)

rect id r1 b =p 40 20 f blue fo 0.3 sw 3
text p =r1.b.c.addY(-2) t "TEST" ha c f #fff fs 20`,

/*******************************************/

'Arrow Pointing To Function':
`init w 28em r -2 -2 7 2 fss 0.0201; grid; axis;

# Modify this value to change where the arrow points
$x=1.8

# Modify this value to change the function
$f=(x)=>{return M.sin(x*2)}

$p=P($.x, $.f($.x))
func fn "$.f" r 0 {=2*M.PI} 100
point p =p; arrow p 4.8 1.4 =p o 0.5 sw 1.5 sda 0.05 sc red
text p 5.1 1.4 t {=M.round($.f($.x) * 100)/100}`,

/*******************************************/

'Riemann Sum Bars':
`init w 30em r -10 -20 150 100 fss 0.333; grid; axis;

# Modify this value to change the number of bars
$barWidth=5.4

$f=(x)=>{return (Math.sin(x / 15) * 23) + 46}
func fn "$.f" r 0 200 100 sw 2

{ // Riemann Sum Bars
let width=$.barWidth; let b=B(30, 0, width, 10); let _='';
for (let i=30; i < 100; i+=width, b.x += width)
    _ += \`rect b \${b.setH($.f(i))} f red fo 0.3;\`;
return _
}`,
};


function initialize()
{
    let saveButton = document.getElementById('save_button');
    saveButton.addEventListener('click', addPreset);

    let deleteButton = document.getElementById('delete_button');
    deleteButton.addEventListener('click', deletePreset);

    let resetPresetsButton = document.getElementById('reset_presets_button');
    resetPresetsButton.addEventListener('click', resetPresetsToDefault);

    let clearTextAreaButton = document.getElementById('clear_textarea_button');
    clearTextAreaButton.addEventListener('click', resetTextArea);

    let inputElement = document.getElementById('input');
    inputElement.addEventListener('input', evt => { parseInput(inputElement.value) });

    parseInput(inputElement.value);

    getPresetsFromLocalStorage();

    let presetsElement = document.getElementById('presets_list');
    presetsElement.addEventListener('change', evt => {
        if (presets.hasOwnProperty(presetsElement.value))
        {
            inputElement.value = presets[presetsElement.value];
            parseInput(inputElement.value);
        }
    });

    updatePresetsElement();
}


function resetTextArea()
{
    let inputElement = document.getElementById('input');
    inputElement.value = "init w 30em r -10 -10 150 100 fss 0.333; grid; axis;\n";
    parseInput(inputElement.value);
}


function resetPresetsToDefault()
{
    presets = {};

    for (let name in defaultPresets)
    {
        if (defaultPresets.hasOwnProperty(name))
        {
            presets[name] = defaultPresets[name];
        }
    }

    savePresetsToLocalStorage();
    updatePresetsElement();
}


function getPresetsFromLocalStorage()
{
    presets = window.localStorage.getItem('presets');

    if (presets) presets = JSON.parse(presets);
    else resetPresetsToDefault();
}


function savePresetsToLocalStorage()
{
    window.localStorage.setItem('presets', JSON.stringify(presets));
}


function addPreset()
{
    let presetsElement = document.getElementById('presets_list');

    let name = "";
    if (!presetsElement.value.startsWith("-- ")) name = presetsElement.value;
    name = window.prompt("Preset Name:", name);

    if ((name != null) && (name != ""))
    {
        let inputElement = document.getElementById('input');
        presets[name] = inputElement.value;

        savePresetsToLocalStorage();
        updatePresetsElement(name);
    }
}


function deletePreset()
{
    let presetsElement = document.getElementById('presets_list');
    if (presets.hasOwnProperty(presetsElement.value))
    {
        delete presets[presetsElement.value];

        savePresetsToLocalStorage();
        updatePresetsElement();
    }
}


function addOption(selectElement, value, text, selected)
{
    let optionElement = document.createElement('option');
    optionElement.value = value;
    optionElement.text = text;
    optionElement.selected = selected;
    selectElement.appendChild(optionElement);
}


function updatePresetsElement(selectedValue)
{
    let presetsElement = document.getElementById('presets_list');

    // Remove all child nodes
    while (presetsElement.hasChildNodes())
    {
        presetsElement.removeChild(presetsElement.lastChild);
    }

    addOption(presetsElement, "-- Presets --", "-- Presets --");

    for (let name in presets)
    {
        addOption(presetsElement, name, name, (name == selectedValue));
    }
}


function parseInput(input)
{
    let outputElement = document.getElementById('output');

    // Remove all child nodes
    while (outputElement.hasChildNodes())
    {
        outputElement.removeChild(outputElement.lastChild);
    }

    let textNode = document.createTextNode(input);

    let element = document.createElement('div');
    element.setAttribute('data-content-type', 'cgraph_1');
    element.appendChild(textNode);
    outputElement.appendChild(element);

    CGraph.convertElement(element, {shrinkable: true});
}


initialize();

