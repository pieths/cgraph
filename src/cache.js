var cache = null;
var maxSize = 10;

function enable(enableCache)
{
    if (enableCache && !enabled())
    {
        cache = new Array();
    }
    else if (!enableCache)
    {
        cache = null;
    }
}

function enabled() { return cache !== null; }

/*
 * NOTE: consider using a data-cache-id attribute for the
 * source element which would be used along with the text
 * to determine if the element is cached. This would fix
 * the issue where there are two or more identical source
 * texts on the same page and only the last one on the page
 * gets the result (because the cached element is reparented
 * each time a duplicate is found).
 * The id attribute can be placed there by the javascript
 * code and not the user to avoid having to type too much.
 */
function get(key)
{
    var result = null;

    if (cache != null)
    {
        var index = cache.findIndex(item => item.key == key);
        if (index >= 0) result = cache[index].rootNode;
    }

    return result;
}

function put(key, rootNode)
{
    var index = cache.findIndex(item => item.key == key);
    if (index === -1)
    {
        cache.push({key: key, rootNode: rootNode});

        if (cache.length > maxSize)
        {
            cache.shift();
        }
    }
    else
    {
        let removed = cache.splice(index, 1);

        removed[0].rootNode = rootNode;
        cache.push(removed[0]);
    }
}

export const Cache = {
    enable: function(enableCache) { enable(enableCache); },
    enabled: function() { return enabled(); },
    get: function(key) { return get(key); },
    put: function(key, rootNode) { put(key, rootNode); }
};
