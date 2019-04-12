/* Copyright (c) 2019, Piet Hein Schouten. All rights reserved.
 * Licensed under the terms of the MIT license.
 */
import {CGraph} from '../src/cgraph.js';


var presets = {};


function initialize()
{
    let saveButton = document.getElementById('save_button');
    saveButton.addEventListener('click', addPreset);

    let deleteButton = document.getElementById('delete_button');
    deleteButton.addEventListener('click', deletePreset);

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


function getPresetsFromLocalStorage()
{
    presets = window.localStorage.getItem('presets');
    presets = presets ? JSON.parse(presets) : {};
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

